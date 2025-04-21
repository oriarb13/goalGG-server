import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  // Helper methods to create specific error types
  static badRequest(message: string): AppError {
    return new AppError(message, 400);
  }

  static unauthorized(message: string): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message: string): AppError {
    return new AppError(message, 403);
  }

  static notFound(message: string): AppError {
    return new AppError(message, 404);
  }

  static internal(message: string): AppError {
    return new AppError(message, 500);
  }
}

// Error handling middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error("ERROR 💥", err);

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = "Resource not found";
    error = AppError.notFound(message);
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const message = "Duplicate field value entered";
    error = AppError.badRequest(message);
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values((err as any).errors)
      .map((val: any) => val.message)
      .join(", ");
    error = AppError.badRequest(message);
  }

  // JWT token errors
  if (err.name === "JsonWebTokenError") {
    const message = "Invalid token. Please log in again.";
    error = AppError.unauthorized(message);
  }

  if (err.name === "TokenExpiredError") {
    const message = "Your token has expired. Please log in again.";
    error = AppError.unauthorized(message);
  }

  // Send response
  const statusCode = (error as AppError).statusCode || 500;
  const status = (error as AppError).status || "error";

  res.status(statusCode).json({
    success: false,
    status,
    message: error.message || "Something went wrong",
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
};
