// routes/adminBooking.route.js
import express from "express";
import { listByCompany } from "../controllers/ReceptionController.js";
import {authRequired}  from "../middlewares/auth.middleware.js";
import {requireRoles} from "../middlewares/role.middleware.js";

const router = express.Router();

router.use(authRequired);

// ADMIN / ADMIN_HOTEL: list booking theo company
router.get("/company", listByCompany); // GET /api/admin/bookings/company

export default router;
