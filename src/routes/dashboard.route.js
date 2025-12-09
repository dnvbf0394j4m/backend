// src/routes/admin.route.js
import express from "express";
import { getAdminHotelDashboard,getMyHotels } from "../controllers/adminDashboardController.js";
import { authRequired } from "../middlewares/auth.middleware.js";
import {requireRoles} from "../middlewares/role.middleware.js";

const router = express.Router();

router.use(authRequired, requireRoles("ADMIN_HOTEL", "ADMIN"));

router.get("/my-hotels", getMyHotels);
router.get("", getAdminHotelDashboard);



export default router;
