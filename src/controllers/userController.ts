import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { AppError } from "../middleware/errorMiddleware";
import { UserRoleEnum } from "../types/enums";
import { userService } from "../services/userService";

// Interface for authenticated request
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRoleEnum;
  };
}

// Helper: Generate JWT
const generateToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "secret", {
    expiresIn: "30d",
  });
};

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      password,
      sportCategory,
      yearOfBirth,
      region,
      city,
    } = req.body;

    const user = await userService.createUser({
      firstName,
      lastName,
      phone,
      email,
      password,
      sportCategory,
      yearOfBirth,
      region,
      city,
      role: UserRoleEnum.USER, // Regular user by default
    });

    // Generate token
    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        sportCategory: user.sportCategory,
        token,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    // Check if email and password were provided
    if (!email || !password) {
      return next(AppError.badRequest("Please provide email and password"));
    }

    // Find user by email with password included
    const user = await User.findOne({ email }).select("+password");

    // Check if user exists and password matches
    if (!user || !(await user.matchPassword(password))) {
      return next(AppError.unauthorized("Invalid email or password"));
    }

    // Generate token
    const token = generateToken(user._id.toString());

    res.status(200).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

// @desc    Get current authenticated user data
// @route   GET /api/users/getConnectedUser
// @access  Private
export const getConnectedUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    // Get fresh user data from database
    const user = await userService.getUserById(req.user.id);

    if (!user) {
      return next(AppError.notFound("User not found or session expired"));
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    next(error);
  }
};

// @desc    Update current authenticated user
// @route   PUT /api/users/updateConnectedUser/:id
// @access  Private
export const updateConnectedUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    // Check if the ID in the URL is the same as the authenticated user ID
    if (
      req.params.id !== req.user.id &&
      req.user.role !== UserRoleEnum.SUPER_ADMIN
    ) {
      return next(AppError.forbidden("You can only update your own profile"));
    }

    // For security reasons, don't allow role change through this endpoint
    if (req.body.role && req.user.role !== UserRoleEnum.SUPER_ADMIN) {
      delete req.body.role;
    }

    const user = await userService.updateUser(req.params.id, req.body);

    if (!user) {
      return next(AppError.notFound("User not found"));
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    next(error);
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await userService.getAllUsers();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error: any) {
    next(error);
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await userService.getUserById(req.params.id);

    if (!user) {
      return next(AppError.notFound("User not found"));
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    next(error);
  }
};

// @desc    Get users by group
// @route   GET /api/users/byGroup/:groupId
// @access  Private
export const getUsersByGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await userService.getUsersByGroup(req.params.groupId);

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error: any) {
    next(error);
  }
};

// @desc    Get users by event
// @route   GET /api/users/byEvent/:eventId
// @access  Private
export const getUsersByEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await userService.getUsersByEvent(req.params.eventId);

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error: any) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private
export const deleteUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    // Check if user is deleting own profile or is super admin
    if (
      req.params.id !== req.user.id &&
      req.user.role !== UserRoleEnum.SUPER_ADMIN
    ) {
      return next(AppError.forbidden("You can only delete your own account"));
    }

    const result = await userService.deleteUser(req.params.id);

    if (!result) {
      return next(AppError.notFound("User not found"));
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

// @desc    Update user subscription
// @route   POST /api/users/changeSubscription/:subscriptionId
// @access  Private
export const updateUserSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    const { subscriptionId } = req.params;
    let newSubscriptionRole: UserRoleEnum;

    // Map subscription ID to the corresponding role
    switch (subscriptionId) {
      case "silver":
        newSubscriptionRole = UserRoleEnum.SILVER;
        break;
      case "gold":
        newSubscriptionRole = UserRoleEnum.GOLD;
        break;
      case "premium":
        newSubscriptionRole = UserRoleEnum.PREMIUM;
        break;
      default:
        return next(AppError.badRequest("Invalid subscription type"));
    }

    const result = await userService.updateUserSubscription(
      req.user.id,
      newSubscriptionRole
    );

    if (!result) {
      return next(AppError.badRequest("Failed to update subscription"));
    }

    res.status(200).json({
      success: true,
      message: `Subscription updated to ${subscriptionId} successfully`,
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};
