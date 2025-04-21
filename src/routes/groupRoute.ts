import express, { Router } from "express";
import {
  createGroup,
  getAllGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  leaveGroupRequest,
  joinGroupRequest,
  cancelJoinRequest,
  acceptJoinRequest,
  rejectJoinRequest,
} from "../controllers/groupController";
import { protect, authorize } from "../middleware/authMiddleware";
import { UserRoleEnum } from "../types/enums";

const router: Router = express.Router();

// כל הניתובים דורשים אימות
router.use(protect);

// ניתובים בסיסיים לקבוצות
router
  .route("/")
  .get(getAllGroups)
  .post(
    authorize([UserRoleEnum.SILVER, UserRoleEnum.GOLD, UserRoleEnum.PREMIUM, UserRoleEnum.SUPER_ADMIN]),
    createGroup
  );

router
  .route("/:id")
  .get(getGroupById)
  .put(updateGroup) // הרשאות ייבדקו בקונטרולר (מנהל/קפטן)
  .delete(deleteGroup); // הרשאות ייבדקו בקונטרולר (מנהל בלבד)

// ניתובי בקשות חברות
router.post("/leaveGroup/:groupId", leaveGroupRequest);
router.post("/joinRequest/:groupId", joinGroupRequest);
router.post("/cancelJoinRequest/:groupId", cancelJoinRequest);
router.post("/acceptJoinRequest/:groupId/:userId", acceptJoinRequest); // הרשאות ייבדקו בקונטרולר (מנהל/קפטן)
router.post("/rejectJoinRequest/:groupId/:userId", rejectJoinRequest); // הרשאות ייבדקו בקונטרולר (מנהל/קפטן)

export default router;
