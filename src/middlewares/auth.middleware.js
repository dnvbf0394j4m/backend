    // import jwt from "jsonwebtoken";
    // import { User } from "../models/User.js";

    // export async function authRequired(req, res, next) {
    //   try {
    //     const header = req.headers.authorization || "";
    //     const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    //     if (!token) return res.status(401).json({ error: "Unauthorized" });

    //     const payload = jwt.verify(token, process.env.JWT_SECRET);
    //     const user = await User.findById(payload.sub).populate("roles");
    //     if (!user) return res.status(401).json({ error: "Unauthorized" });

    //     req.user = user;
    //     next();
    //   } catch (e) {
    //     return res.status(401).json({ error: "Unauthorized" });
    //   }
    // }



// auth.middleware.js
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export async function authRequired(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub); // KHÔNG populate roles
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    req.user = user.toObject();
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
