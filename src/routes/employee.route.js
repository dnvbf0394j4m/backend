import {Router} from "express";
import *as staff from "../controllers/EmployeeController.js";
import {authRequired}  from "../middlewares/auth.middleware.js";
import {requireRoles} from "../middlewares/role.middleware.js";
import { ROLE } from "../constants/roles.js";

const router = Router();

router.get("/",
  authRequired,
  requireRoles(ROLE.ADMIN, ROLE.ADMIN_HOTEL),
  staff.getEmployees
);



export default router;