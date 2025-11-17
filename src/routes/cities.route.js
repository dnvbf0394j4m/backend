import { Router } from "express";
import * as Cities from "../controllers/CitiesController.js";
import { authRequired } from "../middlewares/auth.middleware.js";
import { requireRoles } from "../middlewares/role.middleware.js";
import { ROLE } from "../constants/roles.js";

const router = Router();

// Public:
router.get("/", Cities.list);
router.get("/:id", Cities.detail);

// Admin only:
router.post("/", authRequired, requireRoles(ROLE.ADMIN), Cities.create);
router.put("/:id", authRequired, requireRoles(ROLE.ADMIN), Cities.update);
router.delete("/:id", authRequired, requireRoles(ROLE.ADMIN), Cities.remove);

export default router;
