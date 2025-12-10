import { Router } from "express";

import { requireAdminOrAdminHotel, requireOwnCompanyOnCreate, enforceHotelOwnership } from "../middlewares/companyScope.middleware.js";
import * as Hotels from "../controllers/HotelsController.js";
import { uploadHotelImages } from "../middlewares/upload.middleware.js";
import { authRequired } from "../middlewares/auth.middleware.js";
import { requireRoles } from "../middlewares/role.middleware.js";
import { ROLE } from "../constants/roles.js";

const router = Router();


router.get("/", authRequired, requireAdminOrAdminHotel, Hotels.list);

router.get("/public/list", Hotels.publicList);
router.get("/public/:id", Hotels.publicDetail);
router.get("/public/:id/available-rooms", Hotels.publicAvailableRooms);



router.get("/:id", authRequired, requireAdminOrAdminHotel, enforceHotelOwnership, Hotels.detail);

// Create: ADMINHOTEL bị ép company=req.user.company; ADMIN có thể chỉ định company
// router.post("/", authRequired, requireAdminOrAdminHotel, requireOwnCompanyOnCreate, Hotels.create);
router.post(
  "/",
  authRequired,
 
  requireRoles(ROLE.ADMIN,ROLE.ADMIN_HOTEL),      

  uploadHotelImages.array("images", 10),

  requireOwnCompanyOnCreate,
 
  Hotels.create
);

// Update/Delete/Restore: ADMINHOTEL chỉ khi hotel thuộc công ty mình
router.put("/:id", authRequired, requireAdminOrAdminHotel, enforceHotelOwnership, Hotels.update);
router.patch("/:id", authRequired, requireAdminOrAdminHotel, enforceHotelOwnership, Hotels.update);
router.delete("/:id", authRequired, requireAdminOrAdminHotel, enforceHotelOwnership, Hotels.remove);
router.patch("/:id/restore", authRequired, requireAdminOrAdminHotel, enforceHotelOwnership, Hotels.restore);

router.get("/:id/rooms", authRequired, Hotels.listRoomsOfHotel);


// Upload 1 ảnh hoặc nhiều ảnh
router.post(
  "/:hotelId/images",
  uploadHotelImages.array("images", 10),
  Hotels.uploadHotelImageController
);

router.delete("/:hotelId/images/:imageId", Hotels.deleteHotelImageController);

export default router;
