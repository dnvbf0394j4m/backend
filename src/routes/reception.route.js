import { Router } from "express";
import { authRequired } from "../middlewares/auth.middleware.js";
import * as Reception from "../controllers/ReceptionController.js";
import { requireRoles } from "../middlewares/role.middleware.js";
const router = Router();

router.use(authRequired);

router.post("/bookings",             Reception.create);
router.get ("/bookings",             Reception.list);
router.get ("/bookings/:id",         Reception.detail);
router.post("/bookings/:id/payments",Reception.addPayment);
router.post("/bookings/:id/cancel",  Reception.cancel);
router.post("/bookings/:id/checkin", Reception.checkIn);
router.post("/bookings/:id/checkout",Reception.checkOut);


router.delete("/bookings/:id",               Reception.softDelete);
router.patch ("/bookings/:id/restore",       Reception.restore);
router.patch ("/bookings/:id/dates",         Reception.updateDates);
router.patch ("/bookings/:id/rooms",         Reception.updateRooms);



router.get("/can-review/:hotelId", Reception.canReview);

export default router;
