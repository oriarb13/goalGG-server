import mongoose from "mongoose";
import User from "../models/User";
import Group from "../models/Group";
import Event from "../models/Event";
import { AppError } from "../middleware/errorMiddleware";
import { UserRoleEnum, GroupStatusEnum } from "../types/enums";

class UserService {
  /**
   * Create a new user
   * @param userData User data to create
   * @returns Created user
   */
  async createUser(userData: any) {
    try {
      const user = await User.create(userData);
      return user;
    } catch (error: any) {
      if (error.code === 11000) {
        // ייתכן דאפליקט של אימייל
        throw AppError.badRequest("Email already exists");
      }
      throw error;
    }
  }

  /**
   * Get all users
   * @returns Array of all users
   */
  async getAllUsers() {
    return await User.find({});
  }

  /**
   * Get user by ID
   * @param id User ID
   * @returns User or null if not found
   */
  async getUserById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest("Invalid user ID");
    }
    return await User.findById(id);
  }

  /**
   * Get users by group ID
   * @param groupId Group ID
   * @returns Array of users in the group
   */
  async getUsersByGroup(groupId: string) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw AppError.badRequest("Invalid group ID");
    }

    // Get the group to find all member IDs
    const group = await Group.findById(groupId);
    if (!group) {
      throw AppError.notFound("Group not found");
    }

    // Extract all user IDs from the members array
    const memberIds = group.members.map((member) => member.userId);

    // Fetch all users with those IDs
    return await User.find({ _id: { $in: memberIds } });
  }

  /**
   * Get users by event ID
   * @param eventId Event ID
   * @returns Array of users in the event
   */
  async getUsersByEvent(eventId: string) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw AppError.badRequest("Invalid event ID");
    }

    // Get the event to find all participant IDs
    const event = await Event.findById(eventId);
    if (!event) {
      throw AppError.notFound("Event not found");
    }

    // Extract all user IDs from the teams
    let userIds: mongoose.Types.ObjectId[] = [];

    // Iterate through the Map of teams
    event.teams.forEach((teamMembers) => {
      userIds = userIds.concat(teamMembers);
    });

    // Fetch all users with those IDs
    return await User.find({ _id: { $in: userIds } });
  }

  /**
   * Update user data
   * @param id User ID
   * @param updateData Data to update
   * @returns Updated user or null if not found
   */
  async updateUser(id: string, updateData: any) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest("Invalid user ID");
    }

    // נמנע עדכון של שדות רגישים באופן ישיר
    const { password, role, subscriptions, ...safeUpdateData } = updateData;

    return await User.findByIdAndUpdate(id, safeUpdateData, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Delete user
   * @param id User ID
   * @returns true if deleted, false if not found
   */
  async deleteUser(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest("Invalid user ID");
    }

    // Consider performing additional cleanup:
    // 1. Remove user from groups they're a member of
    // 2. Remove user from events they're participating in
    // 3. Handle any pending requests

    const user = await User.findByIdAndDelete(id);
    return !!user;
  }

  /**
   * Update user's subscription
   * @param userId User ID
   * @param newRole New subscription role
   * @returns Updated user or null if change is not possible
   */
  async updateUserSubscription(userId: string, newRole: UserRoleEnum) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest("Invalid user ID");
    }

    // Verify the user exists
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }

    // Verify it's a valid subscription role
    if (
      ![UserRoleEnum.SILVER, UserRoleEnum.GOLD, UserRoleEnum.PREMIUM].includes(
        newRole
      )
    ) {
      throw AppError.badRequest("Invalid subscription type");
    }

    // Get current settings for comparison
    const currentRole = user.role;
    const currentSubscription = user.subscriptions;

    // If user already has this subscription, no need to change
    if (currentRole === newRole) {
      return user;
    }

    // Get subscription limits for the new role
    let newMaxGroups = 0;
    let newMaxPlayers = 0;
    let newCost = 0;

    switch (newRole) {
      case UserRoleEnum.SILVER:
        newMaxGroups = 1;
        newMaxPlayers = 25;
        newCost = 15;
        break;
      case UserRoleEnum.GOLD:
        newMaxGroups = 3;
        newMaxPlayers = 30;
        newCost = 25;
        break;
      case UserRoleEnum.PREMIUM:
        newMaxGroups = 5;
        newMaxPlayers = 500;
        newCost = 40;
        break;
    }

    // Check if downgrading is possible (enough group capacity)
    if (
      newMaxGroups < currentSubscription.maxGroups &&
      (currentSubscription.groupIds?.length || 0) > newMaxGroups
    ) {
      throw AppError.badRequest(
        `Cannot downgrade: You have ${
          currentSubscription.groupIds?.length || 0
        } groups, but the new plan allows only ${newMaxGroups}`
      );
    }

    // Check each group the user owns to see if they exceed the new player limit
    if (newMaxPlayers < currentSubscription.maxPlayers) {
      const groups = await Group.find({ admin: userId });

      for (const group of groups) {
        if (group.members.length > newMaxPlayers) {
          throw AppError.badRequest(
            `Cannot downgrade: Your group "${group.name}" has ${group.members.length} members, but the new plan allows only ${newMaxPlayers}`
          );
        }
      }
    }

    // If we got here, the subscription change is possible
    // First, update all the groups owned by this user to have the new maxPlayers limit
    await Group.updateMany(
      { admin: userId },
      {
        maxPlayers: newMaxPlayers,
        // If the current member count now equals or exceeds the new max, set status to FULL
        $set: {
          status: {
            $cond: [
              { $gte: [{ $size: "$members" }, newMaxPlayers] },
              GroupStatusEnum.FULL,
              "$status",
            ],
          },
        },
      }
    );

    // Now update the user's subscription
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        role: newRole,
        subscriptions: {
          ...currentSubscription,
          maxGroups: newMaxGroups,
          maxPlayers: newMaxPlayers,
          cost: newCost,
          // Update dates for the new subscription period
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
      },
      { new: true }
    );

    return updatedUser;
  }

  /**
   * Add group to admin's subscriptions
   * @param adminId Admin ID
   * @param groupId Group ID
   * @returns Updated admin or null if not found
   */
  async addGroupToAdmin(adminId: string, groupId: string) {
    if (
      !mongoose.Types.ObjectId.isValid(adminId) ||
      !mongoose.Types.ObjectId.isValid(groupId)
    ) {
      throw AppError.badRequest("Invalid ID format");
    }

    // בדיקה שהמשתמש הוא אכן מנהל
    const admin = await User.findById(adminId);

    if (!admin) {
      return null;
    }

    if (
      ![
        UserRoleEnum.SILVER,
        UserRoleEnum.GOLD,
        UserRoleEnum.PREMIUM,
        UserRoleEnum.SUPER_ADMIN,
      ].includes(admin.role as UserRoleEnum)
    ) {
      throw AppError.badRequest("User does not have a subscription plan");
    }

    // בדיקה שהקבוצה כבר לא קיימת במנוי
    if (
      admin.subscriptions?.groupIds?.includes(
        new mongoose.Types.ObjectId(groupId)
      )
    ) {
      return null;
    }

    // בדיקה שמספר הקבוצות לא חורג מהמגבלה
    const maxGroups = admin.subscriptions?.maxGroups || 0;
    const currentGroupCount = admin.subscriptions?.groupIds?.length || 0;

    if (maxGroups > 0 && currentGroupCount >= maxGroups) {
      throw AppError.badRequest(
        `Maximum number of groups (${maxGroups}) reached for this subscription`
      );
    }

    // הוספת הקבוצה למנוי
    return await User.findByIdAndUpdate(
      adminId,
      { $addToSet: { "subscriptions.groupIds": groupId } },
      { new: true }
    );
  }

  /**
   * Remove group from admin's subscriptions
   * @param adminId Admin ID
   * @param groupId Group ID
   * @returns Updated admin or null if not found
   */
  async removeGroupFromAdmin(adminId: string, groupId: string) {
    if (
      !mongoose.Types.ObjectId.isValid(adminId) ||
      !mongoose.Types.ObjectId.isValid(groupId)
    ) {
      throw AppError.badRequest("Invalid ID format");
    }

    return await User.findByIdAndUpdate(
      adminId,
      { $pull: { "subscriptions.groupIds": groupId } },
      { new: true }
    );
  }

  /**
   * Find users by role
   * @param role User role
   * @returns Array of users with specified role
   */
  async findUsersByRole(role: UserRoleEnum) {
    return await User.find({ role });
  }

  /**
   * Count users by role
   * @param role User role
   * @returns Count of users with specified role
   */
  async countUsersByRole(role: UserRoleEnum) {
    return await User.countDocuments({ role });
  }
}

export const userService = new UserService();
