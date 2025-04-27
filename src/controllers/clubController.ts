import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorMiddleware";
import { clubService } from "../services/clubService";
import { UserRoleEnum } from "../types/enums";

// Interface for authenticated request
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRoleEnum;
  };
}

// @desc    Get all clubs
// @route   GET /api/clubs
// @access  Private
export const getAllClubs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const clubs = await clubService.getAllClubs();

    res.status(200).json({
      success: true,
      count: clubs.length,
      data: clubs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get club by ID
// @route   GET /api/clubs/:id
// @access  Private
export const getClubById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const club = await clubService.getClubById(req.params.id);

    if (!club) {
      return next(AppError.notFound("Club not found"));
    }

    res.status(200).json({
      success: true,
      data: club,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new club
// @route   POST /api/clubs
// @access  Private (Silver/Gold/Premium)
export const createClub = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    // הוספת מזהה המשתמש כמנהל
    const clubData = {
      ...req.body,
      admin: req.user.id,
    };

    const club = await clubService.createClub(
      clubData,
      req.user.id,
      req.user.role
    );

    res.status(201).json({
      success: true,
      data: club,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update club
// @route   PUT /api/clubs/:id
// @access  Private (Club Admin/Captain)
export const updateClub = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    const club = await clubService.updateClub(
      req.params.id,
      req.body,
      req.user.id
    );

    if (!club) {
      return next(
        AppError.notFound(
          "Club not found or you are not authorized to update this club"
        )
      );
    }

    res.status(200).json({
      success: true,
      data: club,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete club
// @route   DELETE /api/clubs/:id
// @access  Private (Club Admin Only)
export const deleteClub = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    const result = await clubService.deleteClub(req.params.id, req.user.id);

    if (!result) {
      return next(
        AppError.notFound(
          "Club not found or you are not authorized to delete this club"
        )
      );
    }

    res.status(200).json({
      success: true,
      message: "Club deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Leave a club
// @route   POST /api/clubs/leaveClub/:clubId
// @access  Private
export const leaveClubRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    const result = await clubService.leaveClub(req.params.clubId, req.user.id);

    if (!result) {
      return next(
        AppError.notFound("Club not found or you are not a member of this club")
      );
    }

    res.status(200).json({
      success: true,
      message: "Successfully left the club",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send request to join a club
// @route   POST /api/clubs/joinRequest/:clubId
// @access  Private
export const joinClubRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    const result = await clubService.sendJoinRequest(
      req.params.clubId,
      req.user.id,
      req.body.role || "user"
    );

    if (!result) {
      return next(
        AppError.badRequest(
          "Unable to send join request. You may already be a member or have a pending request"
        )
      );
    }

    res.status(200).json({
      success: true,
      message: "Join request sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel a join request
// @route   POST /api/clubs/cancelJoinRequest/:clubId
// @access  Private
export const cancelJoinRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    const result = await clubService.cancelJoinRequest(
      req.params.clubId,
      req.user.id
    );

    if (!result) {
      return next(
        AppError.notFound("Club not found or no pending request exists")
      );
    }

    res.status(200).json({
      success: true,
      message: "Join request cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept a join request
// @route   POST /api/clubs/acceptJoinRequest/:clubId/:userId
// @access  Private (Club Admin/Captain)
export const acceptJoinRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    const result = await clubService.acceptJoinRequest(
      req.params.clubId,
      req.params.userId,
      req.user.id
    );

    if (!result) {
      return next(
        AppError.notFound(
          "Club not found, no pending request exists, or you are not authorized"
        )
      );
    }

    res.status(200).json({
      success: true,
      message: "Join request accepted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a join request
// @route   POST /api/clubs/rejectJoinRequest/:clubId/:userId
// @access  Private (Club Admin/Captain)
export const rejectJoinRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    const result = await clubService.rejectJoinRequest(
      req.params.clubId,
      req.params.userId,
      req.user.id
    );

    if (!result) {
      return next(
        AppError.notFound(
          "Club not found, no pending request exists, or you are not authorized"
        )
      );
    }

    res.status(200).json({
      success: true,
      message: "Join request rejected successfully",
    });
  } catch (error) {
    next(error);
  }
};
