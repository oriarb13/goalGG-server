import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "./errorMiddleware";
import User from "../models/User";
import { UserRoleEnum } from "../types/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRoleEnum;
  };
}

// מידלוור להגנה על ניתובים - דורש אימות
export const protect = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  let token;

  // בדיקה אם יש טוקן בכותרות
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // שליפת הטוקן מהכותרת
      token = req.headers.authorization.split(" ")[1];

      // פענוח הטוקן
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "secret"
      ) as any;

      // שליפת נתוני המשתמש ללא הסיסמה
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return next(AppError.unauthorized("User not found"));
      }

      // הוספת נתוני המשתמש לבקשה
      req.user = {
        id: user._id.toString(),
        role: user.role as UserRoleEnum,
      };

      next();
    } catch (error) {
      return next(AppError.unauthorized("Not authorized, token failed"));
    }
  }

  if (!token) {
    return next(AppError.unauthorized("Not authorized, no token"));
  }
};

// מידלוור להגבלת גישה לפי תפקיד
export const authorize = (roles: UserRoleEnum[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized("User not authenticated"));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Role ${req.user.role} is not authorized to access this resource`
        )
      );
    }

    next();
  };
};
