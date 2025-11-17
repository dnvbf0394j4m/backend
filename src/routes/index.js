import { Router } from "express";
import auth from "./auth.route.js";
import users from "./users.route.js";
import roles from "./roles.route.js";
import rooms from "./rooms.route.js";
import bookings from "./bookings.route.js";
import companies from "./companies.route.js";
import hotelsRouter from "./hotels.route.js";
import citiesRoute from "./cities.route.js";
import receptionRoutes from "./reception.route.js";
import bookingPublicRoutes from "./bookingPublic.route.js";
import paymentRoutes from "./payment.route.js";


const router = Router();
router.use("/auth", auth);
router.use("/users", users);
router.use("/roles", roles);
router.use("/rooms", rooms);
router.use("/bookings", bookings);
router.use("/companies", companies);
router.use("/hotels", hotelsRouter);
router.use("/cities", citiesRoute);
router.use("/reception", receptionRoutes);
router.use("/public", bookingPublicRoutes);

router.use("/payment", paymentRoutes);

export default router;
