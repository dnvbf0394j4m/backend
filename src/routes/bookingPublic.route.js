import { Router } from "express";
import { createOnlineAndPay,publicBookingDetail } from "../controllers/bookingPublicController.js";

const router = Router();

router.post("/bookings/create-and-pay", createOnlineAndPay);
router.get("/bookings/:id", publicBookingDetail);
export default router;
