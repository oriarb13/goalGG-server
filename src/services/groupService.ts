import mongoose from "mongoose";
import Group from "../models/Group";
import User from "../models/User";
import { AppError } from "../middleware/errorMiddleware";
import { GroupStatusEnum, UserRoleEnum } from "../types/enums";

class GroupService {
  /**
   * Get all groups
   * @returns Array of all groups
   */
  async getAllGroups() {
    return await Group.find({})
      .populate("admin", "firstName lastName image")
      .populate("captains", "firstName lastName image")
      .populate("members.userId", "firstName lastName image");
  }

  /**
   * Get group by ID
   * @param id Group ID
   * @returns Group or null if not found
   */
  async getGroupById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest("Invalid group ID");
    }
    return await Group.findById(id)
      .populate("admin", "firstName lastName image")
      .populate("captains", "firstName lastName image")
      .populate("members.userId", "firstName lastName image")
      .populate("pendingRequests.userId", "firstName lastName image");
  }

  /**
   * Create a new group
   * @param groupData Group data
   * @param userId ID of the user creating the group
   * @param userRole Role of the user creating the group
   * @returns Created group
   */
  async createGroup(groupData: any, userId: string, userRole: UserRoleEnum) {
    // בדיקה שלמשתמש יש הרשאות מנוי ליצירת קבוצה
    const user = await User.findById(userId);
    if (!user) {
      throw AppError.notFound("User not found");
    }

    // בדיקה שהמשתמש לא חרג ממכסת הקבוצות המותרת לו
    if (
      [UserRoleEnum.SILVER, UserRoleEnum.GOLD, UserRoleEnum.PREMIUM].includes(
        userRole as UserRoleEnum
      )
    ) {
      const maxGroups = user.subscriptions?.maxGroups || 0;
      const groupCount = await Group.countDocuments({ admin: userId });

      if (maxGroups > 0 && groupCount >= maxGroups) {
        throw AppError.badRequest(
          `You have reached the maximum limit of ${maxGroups} groups for your subscription`
        );
      }

      // הגדרת מגבלת השחקנים לפי סוג המנוי
      if (!groupData.maxPlayers || groupData.maxPlayers <= 0) {
        groupData.maxPlayers = user.subscriptions?.maxPlayers || 25;
      } else if (
        groupData.maxPlayers > (user.subscriptions?.maxPlayers || 25)
      ) {
        groupData.maxPlayers = user.subscriptions?.maxPlayers || 25;
      }
    } else {
      throw AppError.forbidden(
        "Only users with subscription plans can create groups"
      );
    }

    // יצירת הקבוצה
    const group = await Group.create({
      ...groupData,
      admin: userId,
      // הוספת המנהל גם כחבר בקבוצה
      members: [
        {
          userId,
          skillRating: user.avgSkillRating || 0,
          positions: user.positions || [],
          goals: 0,
          assists: 0,
          points: 0,
          matchesCount: 0,
        },
      ],
    });

    // עדכון המשתמש - הוספת הקבוצה לרשימת הקבוצות שלו
    await User.findByIdAndUpdate(userId, {
      $addToSet: { groups: group._id },
    });

    // עדכון מנוי המשתמש - הוספת הקבוצה לרשימת הקבוצות של המנוי
    await User.findByIdAndUpdate(userId, {
      $addToSet: { "subscriptions.groupIds": group._id },
    });

    return group;
  }

  /**
   * Update group data (admin or captain only)
   * @param groupId Group ID
   * @param updateData Data to update
   * @param userId ID of the user making the update
   * @returns Updated group or null if not found or not authorized
   */
  async updateGroup(groupId: string, updateData: any, userId: string) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw AppError.badRequest("Invalid group ID");
    }

    // שליפת הקבוצה לבדיקת הרשאות
    const group = await Group.findById(groupId);
    if (!group) {
      return null;
    }

    // בדיקה שהמשתמש הוא מנהל או קפטן
    const isAdmin = group.admin.toString() === userId;
    const isCaptain = group.captains.some(
      (captainId) => captainId.toString() === userId
    );

    if (!isAdmin && !isCaptain) {
      return null; // אין הרשאה לעדכן
    }

    // אם המשתמש הוא קפטן, הוא יכול לעדכן רק חלק מהשדות
    if (!isAdmin && isCaptain) {
      // הסרת שדות שקפטן לא יכול לעדכן
      delete updateData.admin;
      delete updateData.captains;
      delete updateData.maxPlayers;
      delete updateData.status;
    }

    // עדכון הקבוצה
    return await Group.findByIdAndUpdate(groupId, updateData, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Delete a group (admin only)
   * @param groupId Group ID
   * @param userId ID of the user making the deletion
   * @returns true if deleted, false if not found or not authorized
   */
  async deleteGroup(groupId: string, userId: string) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw AppError.badRequest("Invalid group ID");
    }

    // שליפת הקבוצה לבדיקת הרשאות
    const group = await Group.findById(groupId);
    if (!group) {
      return false;
    }

    // בדיקה שהמשתמש הוא מנהל
    if (group.admin.toString() !== userId) {
      return false;
    }

    // מחיקת הקבוצה מכל המשתמשים שהיא קשורה אליהם
    // 1. חברי הקבוצה
    const memberIds = group.members.map((member) => member.userId);
    await User.updateMany(
      { _id: { $in: memberIds } },
      { $pull: { groups: groupId } }
    );

    // 2. בקשות ממתינות
    const pendingUserIds = group.pendingRequests.map(
      (request) => request.userId
    );
    await User.updateMany(
      { _id: { $in: pendingUserIds } },
      { $pull: { groupsRequests: groupId } }
    );

    // 3. עדכון מנוי המנהל
    await User.findByIdAndUpdate(userId, {
      $pull: { "subscriptions.groupIds": groupId },
    });

    // מחיקת הקבוצה
    await Group.findByIdAndDelete(groupId);
    return true;
  }

  /**
   * Leave a group
   * @param groupId Group ID
   * @param userId ID of the user leaving
   * @returns true if left, false if not found or not a member
   */
  async leaveGroup(groupId: string, userId: string) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw AppError.badRequest("Invalid group ID");
    }

    // שליפת הקבוצה
    const group = await Group.findById(groupId);
    if (!group) {
      return false;
    }

    // בדיקה שהמשתמש אינו המנהל
    if (group.admin.toString() === userId) {
      throw AppError.badRequest(
        "Group admin cannot leave the group. Transfer ownership or delete the group instead."
      );
    }

    // בדיקה שהמשתמש הוא חבר בקבוצה
    const isMember = group.members.some(
      (member) => member.userId.toString() === userId
    );
    if (!isMember) {
      return false;
    }

    // הסרת המשתמש מהקבוצה
    await Group.findByIdAndUpdate(groupId, {
      $pull: {
        members: { userId: new mongoose.Types.ObjectId(userId) },
        captains: new mongoose.Types.ObjectId(userId),
      },
    });

    // הסרת הקבוצה מהמשתמש
    await User.findByIdAndUpdate(userId, {
      $pull: { groups: groupId },
    });

    return true;
  }

  /**
   * Send request to join a group
   * @param groupId Group ID
   * @param userId ID of the user requesting to join
   * @param requestedRole The role requested
   * @returns true if request sent, false if already a member or has pending request
   */
  async sendJoinRequest(
    groupId: string,
    userId: string,
    requestedRole = "user"
  ) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw AppError.badRequest("Invalid group ID");
    }

    // שליפת הקבוצה
    const group = await Group.findById(groupId);
    if (!group) {
      throw AppError.notFound("Group not found");
    }

    // בדיקה שהקבוצה לא מלאה
    if (group.status === GroupStatusEnum.FULL) {
      throw AppError.badRequest("Group is full");
    }

    // בדיקה שהמשתמש אינו כבר חבר בקבוצה
    const isMember = group.members.some(
      (member) => member.userId.toString() === userId
    );
    if (isMember) {
      return false;
    }

    // בדיקה שאין כבר בקשה ממתינה
    const hasPendingRequest = group.pendingRequests.some(
      (request) => request.userId.toString() === userId
    );
    if (hasPendingRequest) {
      return false;
    }

    // הוספת בקשה לקבוצה
    await Group.findByIdAndUpdate(groupId, {
      $push: {
        pendingRequests: {
          userId: new mongoose.Types.ObjectId(userId),
          role: requestedRole,
        },
      },
    });

    // הוספת הקבוצה לבקשות של המשתמש
    await User.findByIdAndUpdate(userId, {
      $addToSet: { groupsRequests: groupId },
    });

    return true;
  }

  /**
   * Cancel a join request
   * @param groupId Group ID
   * @param userId ID of the user cancelling the request
   * @returns true if cancelled, false if no pending request
   */
  async cancelJoinRequest(groupId: string, userId: string) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw AppError.badRequest("Invalid group ID");
    }

    // שליפת הקבוצה
    const group = await Group.findById(groupId);
    if (!group) {
      return false;
    }

    // בדיקה שיש בקשה ממתינה
    const hasPendingRequest = group.pendingRequests.some(
      (request) => request.userId.toString() === userId
    );
    if (!hasPendingRequest) {
      return false;
    }

    // הסרת הבקשה מהקבוצה
    await Group.findByIdAndUpdate(groupId, {
      $pull: {
        pendingRequests: { userId: new mongoose.Types.ObjectId(userId) },
      },
    });

    // הסרת הקבוצה מבקשות המשתמש
    await User.findByIdAndUpdate(userId, {
      $pull: { groupsRequests: groupId },
    });

    return true;
  }

  /**
   * Accept a join request (admin or captain only)
   * @param groupId Group ID
   * @param requestUserId ID of the user who made the request
   * @param adminUserId ID of the admin/captain accepting the request
   * @returns true if accepted, false if not found or not authorized
   */
  async acceptJoinRequest(
    groupId: string,
    requestUserId: string,
    adminUserId: string
  ) {
    if (
      !mongoose.Types.ObjectId.isValid(groupId) ||
      !mongoose.Types.ObjectId.isValid(requestUserId)
    ) {
      throw AppError.badRequest("Invalid ID format");
    }

    // שליפת הקבוצה
    const group = await Group.findById(groupId);
    if (!group) {
      return false;
    }

    // בדיקה שהמשתמש המאשר הוא מנהל או קפטן
    const isAdmin = group.admin.toString() === adminUserId;
    const isCaptain = group.captains.some(
      (captainId) => captainId.toString() === adminUserId
    );
    if (!isAdmin && !isCaptain) {
      return false;
    }

    // בדיקה שיש בקשה ממתינה
    const requestIndex = group.pendingRequests.findIndex(
      (request) => request.userId.toString() === requestUserId
    );
    if (requestIndex === -1) {
      return false;
    }

    // שליפת הבקשה
    const request = group.pendingRequests[requestIndex];
    const requestedRole = request.role;

    // שליפת המשתמש המבקש
    const requestingUser = await User.findById(requestUserId);
    if (!requestingUser) {
      return false;
    }

    // בדיקה שהקבוצה לא מלאה
    if (
      group.status === GroupStatusEnum.FULL ||
      (group.maxPlayers > 0 && group.members.length >= group.maxPlayers)
    ) {
      throw AppError.badRequest("Group is full");
    }

    // עדכון סטטוס הקבוצה אם היא מתמלאת
    let groupUpdate: any = {
      $pull: {
        pendingRequests: { userId: new mongoose.Types.ObjectId(requestUserId) },
      },
      $push: {
        members: {
          userId: new mongoose.Types.ObjectId(requestUserId),
          skillRating: requestingUser.avgSkillRating || 0,
          positions: requestingUser.positions || [],
          goals: 0,
          assists: 0,
          points: 0,
          matchesCount: 0,
        },
      },
    };

    // אם התפקיד המבוקש הוא קפטן, וגם המנהל מאשר (לא קפטן אחר)
    if (requestedRole === "captain" && isAdmin) {
      groupUpdate.$addToSet = {
        captains: new mongoose.Types.ObjectId(requestUserId),
      };
    }

    // בדיקה אם הקבוצה עומדת להתמלא
    if (group.maxPlayers > 0 && group.members.length + 1 >= group.maxPlayers) {
      groupUpdate.status = GroupStatusEnum.FULL;
    }

    // עדכון הקבוצה
    await Group.findByIdAndUpdate(groupId, groupUpdate);

    // עדכון המשתמש
    await User.findByIdAndUpdate(requestUserId, {
      $pull: { groupsRequests: groupId },
      $addToSet: { groups: groupId },
    });

    return true;
  }

  /**
   * Reject a join request (admin or captain only)
   * @param groupId Group ID
   * @param requestUserId ID of the user who made the request
   * @param adminUserId ID of the admin/captain rejecting the request
   * @returns true if rejected, false if not found or not authorized
   */
  async rejectJoinRequest(
    groupId: string,
    requestUserId: string,
    adminUserId: string
  ) {
    if (
      !mongoose.Types.ObjectId.isValid(groupId) ||
      !mongoose.Types.ObjectId.isValid(requestUserId)
    ) {
      throw AppError.badRequest("Invalid ID format");
    }

    // שליפת הקבוצה
    const group = await Group.findById(groupId);
    if (!group) {
      return false;
    }

    // בדיקה שהמשתמש המסרב הוא מנהל או קפטן
    const isAdmin = group.admin.toString() === adminUserId;
    const isCaptain = group.captains.some(
      (captainId) => captainId.toString() === adminUserId
    );
    if (!isAdmin && !isCaptain) {
      return false;
    }

    // בדיקה שיש בקשה ממתינה
    const hasPendingRequest = group.pendingRequests.some(
      (request) => request.userId.toString() === requestUserId
    );
    if (!hasPendingRequest) {
      return false;
    }

    // הסרת הבקשה מהקבוצה
    await Group.findByIdAndUpdate(groupId, {
      $pull: {
        pendingRequests: { userId: new mongoose.Types.ObjectId(requestUserId) },
      },
    });

    // הסרת הקבוצה מבקשות המשתמש
    await User.findByIdAndUpdate(requestUserId, {
      $pull: { groupsRequests: groupId },
    });

    return true;
  }
}

export const groupService = new GroupService();
