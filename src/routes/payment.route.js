// src/routes/payment.route.js
import { Router } from "express";
import { vnpReturn } from "../controllers/paymentController.js";
import * as Reception from "../controllers/ReceptionController.js";

const router = Router();

router.get("/vnpay-return", vnpReturn);
router.get("/payment/susess/:id", Reception.detail);

export default router;
