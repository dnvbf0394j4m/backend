// import { Router } from "express";
// import { authRequired } from "../middlewares/auth.middleware.js";
// import { User } from "../models/User.js";


// const router = Router();

// router.get("/me", authRequired, async (req, res) => {
//   res.json({
//     id: req.user._id,
//     name: req.user.name,
//     email: req.user.email,
//     roles: req.user.roles
//   });
// });

// export default router;


import { Router } from "express";
import * as Users from "../controllers/UsersController.js";
import { authRequired } from "../middlewares/auth.middleware.js";
import { requireRoles } from "../middlewares/role.middleware.js";

const router = Router();

// Xem danh sách/chi tiết: chỉ cần đăng nhập (includeDeleted chỉ cho ADMIN/ADMINHOTEL đã check trong controller)
router.get("/",    authRequired, Users.list);
router.get("/:id", authRequired, Users.detail);

// Tạo/Sửa/Xoá/Khôi phục: yêu cầu quyền cao
router.post("/",           authRequired, requireRoles("ADMIN", "ADMINHOTEL"), Users.create);
router.put("/:id",         authRequired, requireRoles("ADMIN", "ADMINHOTEL"), Users.update);
router.patch("/:id",       authRequired, requireRoles("ADMIN", "ADMINHOTEL"), Users.update);
router.delete("/:id",      authRequired, requireRoles("ADMIN", "ADMINHOTEL"), Users.remove);
router.patch("/:id/restore", authRequired, requireRoles("ADMIN", "ADMINHOTEL"), Users.restore);

export default router;

