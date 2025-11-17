// src/routes/rooms.route.js
import { Router } from "express";
import * as Rooms from "../controllers/RoomsController.js";
import { authRequired } from "../middlewares/auth.middleware.js";
import { requireRoles } from "../middlewares/role.middleware.js";
import { ROLE } from "../constants/roles.js";

import { uploadHotelImages } from "../middlewares/upload.middleware.js";

const router = Router();

// Xem phòng: STAFF/ADMINHOTEL/ADMIN đều được (hoặc public nếu bạn muốn)
router.get("/", authRequired, Rooms.list);
router.get("/:id", authRequired, Rooms.detail);

// Tạo/Sửa/Xoá: ADMIN & ADMINHOTEL
router.post(
  "/",
  authRequired,
  requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL),
  // multer phải đứng TRƯỚC controller để có req.files + req.body
  uploadHotelImages.array("images", 10),
  Rooms.createWithImages // 👈 controller mới
);
router.put("/:id", authRequired, requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL), Rooms.update);
router.delete("/:id", authRequired, requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL), Rooms.remove);
router.patch("/:id/restore", authRequired, requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL), Rooms.restore);

// Upload ảnh phòng
router.post(
  "/:id/images",
  authRequired,
  requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL),
  uploadHotelImages.array("images", 10), // Body: form-data (images: File)*
  Rooms.addImages
);

// Xoá 1 ảnh
router.delete(
  "/:id/images/:imageId",
  authRequired,
  requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL),
  Rooms.removeImage
);


router.get(
  "/hotels/:hotelId/available-rooms",
  authRequired, 
  requireRoles("ADMIN", "ADMIN_HOTEL", "STAFF"), 
  Rooms.listAvailableRooms
);

export default router;
