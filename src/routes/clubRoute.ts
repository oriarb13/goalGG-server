import express, { Router } from "express";
import {
  createClub,
  getAllClubs,
  getClubById,
  updateClub,
  deleteClub,
  leaveClubRequest,
  joinClubRequest,
  cancelJoinRequest,
  acceptJoinRequest,
  rejectJoinRequest,
} from "../controllers/clubController";
import { protect, authorize } from "../middleware/authMiddleware";
import { UserRoleEnum } from "../types/enums";

const router: Router = express.Router();

// כל הניתובים דורשים אימות
router.use(protect);

// ניתובים בסיסיים לקבוצות
router
  .route("/")
  .get(getAllClubs)
  .post(
    authorize([
      UserRoleEnum.SILVER,
      UserRoleEnum.GOLD,
      UserRoleEnum.PREMIUM,
      UserRoleEnum.SUPER_ADMIN,
    ]),
    createClub
  );

router
  .route("/:id")
  .get(getClubById)
  .put(updateClub) // הרשאות ייבדקו בקונטרולר (מנהל/קפטן)
  .delete(deleteClub); // הרשאות ייבדקו בקונטרולר (מנהל בלבד)

// ניתובי בקשות חברות
router.post("/leaveClub/:clubId", leaveClubRequest);
router.post("/joinRequest/:clubId", joinClubRequest);
router.post("/cancelJoinRequest/:clubId", cancelJoinRequest);
router.post("/acceptJoinRequest/:clubId/:userId", acceptJoinRequest); // הרשאות ייבדקו בקונטרולר (מנהל/קפטן)
router.post("/rejectJoinRequest/:clubId/:userId", rejectJoinRequest); // הרשאות ייבדקו בקונטרולר (מנהל/קפטן)

export default router;
