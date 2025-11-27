import express from "express";
import { getMyNotifications } from "../controllers/notificationController.js";
import { authRequired } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authRequired, getMyNotifications);

export default router;
