import mongoose from "mongoose";
import Club from "../models/Club";
import User from "../models/User";
import { AppError } from "../middleware/errorMiddleware";
import { ClubStatusEnum, UserRoleEnum } from "../types/enums";

class ClubService {
  /**
   * Get all clubs
   * @returns Array of all clubs
   */
  async getAllClubs() {
    return await Club.find({})
      .populate("admin", "firstName lastName image")
      .populate("captains", "firstName lastName image")
      .populate("members.userId", "firstName lastName image");
  }

  /**
   * Get club by ID
   * @param id Club ID
   * @returns Club or null if not found
   */
  async getClubById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest("Invalid club ID");
    }
    return await Club.findById(id)
      .populate("admin", "firstName lastName image")
      .populate("captains", "firstName lastName image")
      .populate("members.userId", "firstName lastName image")
      .populate("pendingRequests.userId", "firstName lastName image");
  }

  /**
   * Create a new club
   * @param clubData Club data
   * @param userId ID of the user creating the club
   * @param userRole Role of the user creating the club
   * @returns Created club
   */
  async createClub(clubData: any, userId: string, userRole: UserRoleEnum) {
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
      const maxClubs = user.subscriptions?.maxClubs || 0;
      const clubCount = await Club.countDocuments({ admin: userId });

      if (maxClubs > 0 && clubCount >= maxClubs) {
        throw AppError.badRequest(
          `You have reached the maximum limit of ${maxClubs} clubs for your subscription`
        );
      }

      // הגדרת מגבלת השחקנים לפי סוג המנוי
      if (!clubData.maxPlayers || clubData.maxPlayers <= 0) {
        clubData.maxPlayers = user.subscriptions?.maxPlayers || 25;
      } else if (clubData.maxPlayers > (user.subscriptions?.maxPlayers || 25)) {
        clubData.maxPlayers = user.subscriptions?.maxPlayers || 25;
      }
    } else {
      throw AppError.forbidden(
        "Only users with subscription plans can create clubs"
      );
    }

    // יצירת הקבוצה
    const club = await Club.create({
      ...clubData,
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
      $addToSet: { clubs: club._id },
    });

    // עדכון מנוי המשתמש - הוספת הקבוצה לרשימת הקבוצות של המנוי
    await User.findByIdAndUpdate(userId, {
      $addToSet: { "subscriptions.clubIds": club._id },
    });

    return club;
  }

  /**
   * Update club data (admin or captain only)
   * @param clubId Club ID
   * @param updateData Data to update
   * @param userId ID of the user making the update
   * @returns Updated club or null if not found or not authorized
   */
  async updateClub(clubId: string, updateData: any, userId: string) {
    if (!mongoose.Types.ObjectId.isValid(clubId)) {
      throw AppError.badRequest("Invalid club ID");
    }

    // שליפת הקבוצה לבדיקת הרשאות
    const club = await Club.findById(clubId);
    if (!club) {
      return null;
    }

    // בדיקה שהמשתמש הוא מנהל או קפטן
    const isAdmin = club.admin.toString() === userId;
    const isCaptain = club.captains.some(
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
    return await Club.findByIdAndUpdate(clubId, updateData, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Delete a club (admin only)
   * @param clubId Club ID
   * @param userId ID of the user making the deletion
   * @returns true if deleted, false if not found or not authorized
   */
  async deleteClub(clubId: string, userId: string) {
    if (!mongoose.Types.ObjectId.isValid(clubId)) {
      throw AppError.badRequest("Invalid club ID");
    }

    // שליפת הקבוצה לבדיקת הרשאות
    const club = await Club.findById(clubId);
    if (!club) {
      return false;
    }

    // בדיקה שהמשתמש הוא מנהל
    if (club.admin.toString() !== userId) {
      return false;
    }

    // מחיקת הקבוצה מכל המשתמשים שהיא קשורה אליהם
    // 1. חברי הקבוצה
    const memberIds = club.members.map((member) => member.userId);
    await User.updateMany(
      { _id: { $in: memberIds } },
      { $pull: { clubs: clubId } }
    );

    // 2. בקשות ממתינות
    const pendingUserIds = club.pendingRequests.map(
      (request) => request.userId
    );
    await User.updateMany(
      { _id: { $in: pendingUserIds } },
      { $pull: { clubsRequests: clubId } }
    );

    // 3. עדכון מנוי המנהל
    await User.findByIdAndUpdate(userId, {
      $pull: { "subscriptions.clubIds": clubId },
    });

    // מחיקת הקבוצה
    await Club.findByIdAndDelete(clubId);
    return true;
  }

  /**
   * Leave a club
   * @param clubId Club ID
   * @param userId ID of the user leaving
   * @returns true if left, false if not found or not a member
   */
  async leaveClub(clubId: string, userId: string) {
    if (!mongoose.Types.ObjectId.isValid(clubId)) {
      throw AppError.badRequest("Invalid club ID");
    }

    // שליפת הקבוצה
    const club = await Club.findById(clubId);
    if (!club) {
      return false;
    }

    // בדיקה שהמשתמש אינו המנהל
    if (club.admin.toString() === userId) {
      throw AppError.badRequest(
        "Club admin cannot leave the club. Transfer ownership or delete the club instead."
      );
    }

    // בדיקה שהמשתמש הוא חבר בקבוצה
    const isMember = club.members.some(
      (member) => member.userId.toString() === userId
    );
    if (!isMember) {
      return false;
    }

    // הסרת המשתמש מהקבוצה
    await Club.findByIdAndUpdate(clubId, {
      $pull: {
        members: { userId: new mongoose.Types.ObjectId(userId) },
        captains: new mongoose.Types.ObjectId(userId),
      },
    });

    // הסרת הקבוצה מהמשתמש
    await User.findByIdAndUpdate(userId, {
      $pull: { clubs: clubId },
    });

    return true;
  }

  /**
   * Send request to join a club
   * @param clubId Club ID
   * @param userId ID of the user requesting to join
   * @param requestedRole The role requested
   * @returns true if request sent, false if already a member or has pending request
   */
  async sendJoinRequest(
    clubId: string,
    userId: string,
    requestedRole = "user"
  ) {
    if (!mongoose.Types.ObjectId.isValid(clubId)) {
      throw AppError.badRequest("Invalid club ID");
    }

    // שליפת הקבוצה
    const club = await Club.findById(clubId);
    if (!club) {
      throw AppError.notFound("Club not found");
    }

    // בדיקה שהקבוצה לא מלאה
    if (club.status === ClubStatusEnum.FULL) {
      throw AppError.badRequest("Club is full");
    }

    // בדיקה שהמשתמש אינו כבר חבר בקבוצה
    const isMember = club.members.some(
      (member) => member.userId.toString() === userId
    );
    if (isMember) {
      return false;
    }

    // בדיקה שאין כבר בקשה ממתינה
    const hasPendingRequest = club.pendingRequests.some(
      (request) => request.userId.toString() === userId
    );
    if (hasPendingRequest) {
      return false;
    }

    // הוספת בקשה לקבוצה
    await Club.findByIdAndUpdate(clubId, {
      $push: {
        pendingRequests: {
          userId: new mongoose.Types.ObjectId(userId),
          role: requestedRole,
        },
      },
    });

    // הוספת הקבוצה לבקשות של המשתמש
    await User.findByIdAndUpdate(userId, {
      $addToSet: { clubsRequests: clubId },
    });

    return true;
  }

  /**
   * Cancel a join request
   * @param clubId Club ID
   * @param userId ID of the user cancelling the request
   * @returns true if cancelled, false if no pending request
   */
  async cancelJoinRequest(clubId: string, userId: string) {
    if (!mongoose.Types.ObjectId.isValid(clubId)) {
      throw AppError.badRequest("Invalid club ID");
    }

    // שליפת הקבוצה
    const club = await Club.findById(clubId);
    if (!club) {
      return false;
    }

    // בדיקה שיש בקשה ממתינה
    const hasPendingRequest = club.pendingRequests.some(
      (request) => request.userId.toString() === userId
    );
    if (!hasPendingRequest) {
      return false;
    }

    // הסרת הבקשה מהקבוצה
    await Club.findByIdAndUpdate(clubId, {
      $pull: {
        pendingRequests: { userId: new mongoose.Types.ObjectId(userId) },
      },
    });

    // הסרת הקבוצה מבקשות המשתמש
    await User.findByIdAndUpdate(userId, {
      $pull: { clubsRequests: clubId },
    });

    return true;
  }

  /**
   * Accept a join request (admin or captain only)
   * @param clubId Club ID
   * @param requestUserId ID of the user who made the request
   * @param adminUserId ID of the admin/captain accepting the request
   * @returns true if accepted, false if not found or not authorized
   */
  async acceptJoinRequest(
    clubId: string,
    requestUserId: string,
    adminUserId: string
  ) {
    if (
      !mongoose.Types.ObjectId.isValid(clubId) ||
      !mongoose.Types.ObjectId.isValid(requestUserId)
    ) {
      throw AppError.badRequest("Invalid ID format");
    }

    // שליפת הקבוצה
    const club = await Club.findById(clubId);
    if (!club) {
      return false;
    }

    // בדיקה שהמשתמש המאשר הוא מנהל או קפטן
    const isAdmin = club.admin.toString() === adminUserId;
    const isCaptain = club.captains.some(
      (captainId) => captainId.toString() === adminUserId
    );
    if (!isAdmin && !isCaptain) {
      return false;
    }

    // בדיקה שיש בקשה ממתינה
    const requestIndex = club.pendingRequests.findIndex(
      (request) => request.userId.toString() === requestUserId
    );
    if (requestIndex === -1) {
      return false;
    }

    // שליפת הבקשה
    const request = club.pendingRequests[requestIndex];
    const requestedRole = request.role;

    // שליפת המשתמש המבקש
    const requestingUser = await User.findById(requestUserId);
    if (!requestingUser) {
      return false;
    }

    // בדיקה שהקבוצה לא מלאה
    if (
      club.status === ClubStatusEnum.FULL ||
      (club.maxPlayers > 0 && club.members.length >= club.maxPlayers)
    ) {
      throw AppError.badRequest("Club is full");
    }

    // עדכון סטטוס הקבוצה אם היא מתמלאת
    let clubUpdate: any = {
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
      clubUpdate.$addToSet = {
        captains: new mongoose.Types.ObjectId(requestUserId),
      };
    }

    // בדיקה אם הקבוצה עומדת להתמלא
    if (club.maxPlayers > 0 && club.members.length + 1 >= club.maxPlayers) {
      clubUpdate.status = ClubStatusEnum.FULL;
    }

    // עדכון הקבוצה
    await Club.findByIdAndUpdate(clubId, clubUpdate);

    // עדכון המשתמש
    await User.findByIdAndUpdate(requestUserId, {
      $pull: { clubsRequests: clubId },
      $addToSet: { clubs: clubId },
    });

    return true;
  }

  /**
   * Reject a join request (admin or captain only)
   * @param clubId Club ID
   * @param requestUserId ID of the user who made the request
   * @param adminUserId ID of the admin/captain rejecting the request
   * @returns true if rejected, false if not found or not authorized
   */
  async rejectJoinRequest(
    clubId: string,
    requestUserId: string,
    adminUserId: string
  ) {
    if (
      !mongoose.Types.ObjectId.isValid(clubId) ||
      !mongoose.Types.ObjectId.isValid(requestUserId)
    ) {
      throw AppError.badRequest("Invalid ID format");
    }

    // שליפת הקבוצה
    const club = await Club.findById(clubId);
    if (!club) {
      return false;
    }

    // בדיקה שהמשתמש המסרב הוא מנהל או קפטן
    const isAdmin = club.admin.toString() === adminUserId;
    const isCaptain = club.captains.some(
      (captainId) => captainId.toString() === adminUserId
    );
    if (!isAdmin && !isCaptain) {
      return false;
    }

    // בדיקה שיש בקשה ממתינה
    const hasPendingRequest = club.pendingRequests.some(
      (request) => request.userId.toString() === requestUserId
    );
    if (!hasPendingRequest) {
      return false;
    }

    // הסרת הבקשה מהקבוצה
    await Club.findByIdAndUpdate(clubId, {
      $pull: {
        pendingRequests: { userId: new mongoose.Types.ObjectId(requestUserId) },
      },
    });

    // הסרת הקבוצה מבקשות המשתמש
    await User.findByIdAndUpdate(requestUserId, {
      $pull: { clubsRequests: clubId },
    });

    return true;
  }
}

export const clubService = new ClubService();
