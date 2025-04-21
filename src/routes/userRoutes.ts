import express, { Router } from "express";
import {
  registerUser,
  loginUser,
  getConnectedUser,
  updateConnectedUser,
  getUsers,
  getUser,
  getUsersByGroup,
  getUsersByEvent,
  deleteUser,
  updateUserSubscription,
} from "../controllers/userController";
import { protect, authorize } from "../middleware/authMiddleware";

const router: Router = express.Router();

// ניתובים פתוחים
router.post("/register", registerUser);
router.post("/login", loginUser);

router.use(protect); // מכאן והלאה כל הניתובים דורשים אימות

// ניתובים למשתמש מחובר
router.get("/getConnectedUser", getConnectedUser);
router.put("/updateConnectedUser/:id", updateConnectedUser);

// ניתובים לקבלת משתמשים
router.get("/byGroup/:groupId", getUsersByGroup);
router.get("/byEvent/:eventId", getUsersByEvent);
router.get("/getAllUsers", getUsers);
router.get("/getById/:id", getUser);

// ניתובים למחיקת משתמש
router.delete("/delete/:id", deleteUser);

// ניתובים לשינוי מנוי
router.post("/changeSubscription/:subscriptionId", updateUserSubscription);

export default router;
