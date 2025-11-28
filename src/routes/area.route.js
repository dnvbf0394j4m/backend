import { Router } from "express";
import * as area from "../controllers/AreaController.js";


const router = Router();

// Public:
router.get("/", area.list);

export default router;