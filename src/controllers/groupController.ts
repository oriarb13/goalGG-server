import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorMiddleware';
import { groupService } from '../services/groupService';
import { UserRoleEnum } from '../types/enums';

// Interface for authenticated request
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRoleEnum;
  };
}

// @desc    Get all groups
// @route   GET /api/groups
// @access  Private
export const getAllGroups = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const groups = await groupService.getAllGroups();
    
    res.status(200).json({
      success: true,
      count: groups.length,
      data: groups
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get group by ID
// @route   GET /api/groups/:id
// @access  Private
export const getGroupById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const group = await groupService.getGroupById(req.params.id);
    
    if (!group) {
      return next(AppError.notFound('Group not found'));
    }
    
    res.status(200).json({
      success: true,
      data: group
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private (Silver/Gold/Premium)
export const createGroup = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized('User not authenticated'));
    }
    
    // הוספת מזהה המשתמש כמנהל
    const groupData = { 
      ...req.body,
      admin: req.user.id
    };
    
    const group = await groupService.createGroup(groupData, req.user.id, req.user.role);
    
    res.status(201).json({
      success: true,
      data: group
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update group
// @route   PUT /api/groups/:id
// @access  Private (Group Admin/Captain)
export const updateGroup = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized('User not authenticated'));
    }
    
    const group = await groupService.updateGroup(req.params.id, req.body, req.user.id);
    
    if (!group) {
      return next(AppError.notFound('Group not found or you are not authorized to update this group'));
    }
    
    res.status(200).json({
      success: true,
      data: group
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete group
// @route   DELETE /api/groups/:id
// @access  Private (Group Admin Only)
export const deleteGroup = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized('User not authenticated'));
    }
    
    const result = await groupService.deleteGroup(req.params.id, req.user.id);
    
    if (!result) {
      return next(AppError.notFound('Group not found or you are not authorized to delete this group'));
    }
    
    res.status(200).json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Leave a group
// @route   POST /api/groups/leaveGroup/:groupId
// @access  Private
export const leaveGroupRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized('User not authenticated'));
    }
    
    const result = await groupService.leaveGroup(req.params.groupId, req.user.id);
    
    if (!result) {
      return next(AppError.notFound('Group not found or you are not a member of this group'));
    }
    
    res.status(200).json({
      success: true,
      message: 'Successfully left the group'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send request to join a group
// @route   POST /api/groups/joinRequest/:groupId
// @access  Private
export const joinGroupRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized('User not authenticated'));
    }
    
    const result = await groupService.sendJoinRequest(req.params.groupId, req.user.id, req.body.role || 'user');
    
    if (!result) {
      return next(AppError.badRequest('Unable to send join request. You may already be a member or have a pending request'));
    }
    
    res.status(200).json({
      success: true,
      message: 'Join request sent successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel a join request
// @route   POST /api/groups/cancelJoinRequest/:groupId
// @access  Private
export const cancelJoinRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized('User not authenticated'));
    }
    
    const result = await groupService.cancelJoinRequest(req.params.groupId, req.user.id);
    
    if (!result) {
      return next(AppError.notFound('Group not found or no pending request exists'));
    }
    
    res.status(200).json({
      success: true,
      message: 'Join request cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept a join request
// @route   POST /api/groups/acceptJoinRequest/:groupId/:userId
// @access  Private (Group Admin/Captain)
export const acceptJoinRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized('User not authenticated'));
    }
    
    const result = await groupService.acceptJoinRequest(
      req.params.groupId,
      req.params.userId,
      req.user.id
    );
    
    if (!result) {
      return next(AppError.notFound('Group not found, no pending request exists, or you are not authorized'));
    }
    
    res.status(200).json({
      success: true,
      message: 'Join request accepted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a join request
// @route   POST /api/groups/rejectJoinRequest/:groupId/:userId
// @access  Private (Group Admin/Captain)
export const rejectJoinRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized('User not authenticated'));
    }
    
    const result = await groupService.rejectJoinRequest(
      req.params.groupId,
      req.params.userId,
      req.user.id
    );
    
    if (!result) {
      return next(AppError.notFound('Group not found, no pending request exists, or you are not authorized'));
    }
    
    res.status(200).json({
      success: true,
      message: 'Join request rejected successfully'
    });
  } catch (error) {
    next(error);
  }
};