import { Router } from "express";
import jwt from "jsonwebtoken";
import Joi from "joi";
import { User } from "../models/User.js";
import * as Auth from "../controllers/AuthController.js";

import passport from "../config/passport.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js";

const router = Router();



router.post("/register", Auth.register);



router.post("/login", Auth.login);
router.post("/ok", Auth.refreshToken);



// Step 1: redirect đến Google
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Step 2: Google redirect về backend
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  Auth.googleCallbackHandler
);





export default router;
