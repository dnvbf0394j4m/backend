import { Router } from "express";
import * as Companies from "../controllers/CompaniesController.js";
import { authRequired } from "../middlewares/auth.middleware.js";
import { requireRoles } from "../middlewares/role.middleware.js";
import { ROLE } from "../constants/roles.js";

const router = Router();

// Tuỳ quyền: xem danh sách/chi tiết chỉ cần đăng nhập
router.get("/", authRequired, Companies.list);
router.get("/:id", authRequired, Companies.detail);

// Tạo/Sửa/Xoá: yêu cầu ADMIN hoặc ADMINHOTEL

router.put("/:id", authRequired, requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL), Companies.update);
router.patch("/:id", authRequired, requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL), Companies.update);
router.delete("/:id", authRequired, requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL), Companies.remove);
router.post(
  "/with-admin",
  // chỉ ADMIN hệ thống được tạo công ty mới
  Companies.createWithAdmin
);


router.post(
  "/admin-hotel/staff",
  authRequired,
  requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL),
  Companies.createStaff
);

router.post(
  "/staff/:id/reset-password",
  authRequired,
  requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL),
  Companies.resetStaffPassword
);


export default router;
