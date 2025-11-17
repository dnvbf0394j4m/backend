import { Router } from "express";
import jwt from "jsonwebtoken";
import Joi from "joi";
import { User } from "../models/User.js";
import * as Auth from "../controllers/AuthController.js";

const router = Router();



router.post("/register", Auth.register);



router.post("/login", Auth.login);

export default router;
