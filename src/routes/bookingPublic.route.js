import { Router } from "express";
import { createOnlineAndPay,publicBookingDetail } from "../controllers/bookingPublicController.js";
import { authRequired } from "../middlewares/auth.middleware.js";
const router = Router();

router.post("/bookings/create-and-pay",authRequired, createOnlineAndPay);
router.get("/bookings/:id", publicBookingDetail);
export default router;
