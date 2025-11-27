import express from "express";
import {
  createReview,
  listReviewsByHotel,
  getReviewStats,
  replyReview,

} from "../controllers/reviewController.js";

import { authRequired } from "../middlewares/auth.middleware.js";
import { requireRoles } from "../middlewares/role.middleware.js";

const router = express.Router();

router.post("/", authRequired, createReview);

router.get("/hotel/:hotelId", listReviewsByHotel);
router.get("/hotel/:hotelId/stats", getReviewStats);
router.patch(
  "/:id/reply",
  authRequired,
  requireRoles("ADMIN_HOTEL", "ADMIN"),
  replyReview
);

export default router;
