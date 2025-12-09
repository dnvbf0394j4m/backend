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



// // auth.middleware.js
// import jwt from "jsonwebtoken";
// import { User } from "../models/User.js";

// export async function authRequired(req, res, next) {
//   try {
//     const h = req.headers.authorization || "";
//     const token = h.startsWith("Bearer ") ? h.slice(7) : null;
//     if (!token) return res.status(401).json({ error: "Unauthorized" });

//     const payload = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await User.findById(payload.sub); // KHÔNG populate roles
//     if (!user) return res.status(401).json({ error: "Unauthorized" });

//     req.user = user.toObject();
//     next();
//   } catch {
//     return res.status(401).json({ error: "Unauthorized" });
//   }
// }



// // auth.middleware.js
// import jwt from "jsonwebtoken";
// import { User } from "../models/User.js";

// export async function authRequired(req, res, next) {
//   // ⚠️ BỎ QUA OPTIONS (preflight CORS)
//   if (req.method === "OPTIONS") {
//     return next();
//   }

//   try {
//     const h = req.headers.authorization || "";
//     const token = h.startsWith("Bearer ") ? h.slice(7) : null;
//     if (!token) return res.status(401).json({ error: "Unauthorized" });

//     const payload = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await User.findById(payload.sub);
//     if (!user) return res.status(401).json({ error: "Unauthorized" });

//     req.user = user.toObject();
//     next();
//   } catch (e) {
//     console.error("authRequired error:", e);
//     return res.status(401).json({ error: "Unauthorized" });
//   }
// }


// auth.middleware.js
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export async function authRequired(req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

     console.log("VERIFY JWT_SECRET =", process.env.JWT_SECRET);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 🔐 Check tokenVersion
    const currentVersion = user.tokenVersion || 0;
    const tokenVersion = payload.tokenVersion || 0;

    if (currentVersion !== tokenVersion) {
      console.warn(
        "authRequired: tokenVersion mismatch",
        "db =", currentVersion,
        "token =", tokenVersion
      );
      return res.status(401).json({ error: "Token has been revoked" });
    }

    req.user = {
      id: user._id,
      email: user.email,
      roles: user.roles || [],
      company: user.company || null,
      hotel: user.hotel || null,
    };

    next();
  } catch (e) {
    console.error("authRequired error:", e);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
