import express, { Router } from "express";
import { errorHandler } from "../middleware/errorMiddleware";
import { AppError } from "../middleware/errorMiddleware";
import userRoutes from "./userRoutes";

const router = Router();

// Use user routes
router.use("/users", userRoutes);

// Handle unknown routes
router.use("*", (req, res, next) => {
  next(AppError.notFound(`Endpoint ${req.originalUrl} not found`));
});

// Error handling middleware
router.use(errorHandler);

export default router;
