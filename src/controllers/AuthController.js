

import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { registerSchema, loginSchema } from "../validations/auth.validation.js";

const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "30d";

const isProd = process.env.NODE_ENV === "production";

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,                      // PROD: true (Vercel/Render https)
  sameSite: isProd ? "none" : "lax",   // PROD: "none" để gửi cross-site
  path: "/",                           // route nào cũng thấy được cookie
  maxAge: 30 * 24 * 60 * 60 * 1000,
};


// 🔐 HÀM DÙNG CHUNG CẤP ACCESS + REFRESH + COOKIE
export async function issueTokensForUser(userOrId, res) {
  // luôn lấy lại từ DB + populate cho chắc
  const userId = userOrId._id ? userOrId._id : userOrId;
  console.log("SIGN JWT_SECRET =", process.env.JWT_SECRET);


  const user = await User.findById(userId)
    .populate("hotel", "name")
    .populate("company", "name");

  if (!user) {
    throw new Error("User not found in issueTokensForUser");
  }

  // tăng version
  user.tokenVersion = (user.tokenVersion || 0) + 1;

  const accessPayload = {
    sub: user._id.toString(),
    tokenVersion: user.tokenVersion,
    roles: (user.roles || []).map((r) => String(r).toUpperCase()),
    company: user.company?._id || null,
    hotel: user.hotel?._id || null,
  };

  const accessToken = jwt.sign(accessPayload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  });

  const refreshPayload = { sub: user._id.toString() };
  const refreshToken = jwt.sign(
    refreshPayload,
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES }
  );

  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });

  await user.save();

  // set cookie refresh token
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);

  // trả về luôn user đã populate để login dùng
  return { accessToken, accessPayload, user };
}



export const register = async (req, res) => {
  try {
    const { value, error } = registerSchema.validate(req.body, { stripUnknown: true });

    if (error) return res.status(400).json({ error: error.message });

    const exists = await User.findOne({ email: value.email });
    if (exists) return res.status(400).json({ error: "Email already in use" });

    const user = new User({
      name: value.name,
      email: value.email,
      phone: value.phone,
      roles: ["USER"],
      provider: "local",
    });
    await user.setPassword(value.password);
    await user.save();

    res.status(201).json({ id: user._id, email: user.email });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

// ============ LOGIN – SET COOKIE REFRESH ============
// export const login = async (req, res) => {
//   try {
//     const { value, error } = loginSchema.validate(req.body, { stripUnknown: true });
//     if (error) {
//       return res.status(400).json({ error: error.message });
//     }

//     const { email, password } = value;

//     const user = await User.findOne({ email })
//       .populate("hotel", "name")
//       .populate("company", "name");

//     if (!user || user.isDeleted) {
//       return res.status(401).json({ error: "Invalid credentials" });
//     }

//     const ok = await user.verifyPassword(password);
//     if (!ok) return res.status(401).json({ error: "Invalid credentials" });

//     // TĂNG tokenVersion TRƯỚC
//     user.tokenVersion = (user.tokenVersion || 0) + 1;

//     //  accessToken mang version MỚI
//     const accessPayload = {
//       sub: user._id.toString(),
//       tokenVersion: user.tokenVersion,
//       roles: (user.roles || []).map((r) => String(r).toUpperCase()),
//       company: user.company?._id || null,
//       hotel: user.hotel?._id || null,
//     };

//     const accessToken = jwt.sign(accessPayload, process.env.JWT_SECRET, {
//       expiresIn: ACCESS_EXPIRES,
//     });

//     // 3) Refresh token chỉ cần sub
//     const refreshPayload = { sub: user._id.toString() };
//     const refreshToken = jwt.sign(
//       refreshPayload,
//       process.env.JWT_REFRESH_SECRET,
//       { expiresIn: REFRESH_EXPIRES }
//     );

//     user.refreshTokens = user.refreshTokens || [];
//     user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });

//     await user.save();

//     //  COOKIE CHUẨN LOCALHOST
//     res.cookie("refreshToken", refreshToken, refreshCookieOptions);

//     res.json({
//       accessToken,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         roles: accessPayload.roles,
//         hotel: user.hotel
//           ? { id: user.hotel._id, name: user.hotel.name }
//           : null,
//         company: user.company
//           ? { id: user.company._id, name: user.company.name }
//           : null,
//         firstLogin: user.firstLogin,
//       },
//     });
//   } catch (e) {
//     console.error(e);
//     res.status(400).json({ error: e.message || "Login error" });
//   }
// };


// ============ LOGIN – SET COOKIE REFRESH ============
export const login = async (req, res) => {
  try {
    const { value, error } = loginSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { email, password } = value;

    const found = await User.findOne({ email });
    if (!found || found.isDeleted) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await found.verifyPassword(password);
    if (!ok) return res.status(401).json({ error: "mat khau kh khớp" });

    // ✅ dùng helper chung – trả về user đã populate
    const { accessToken, accessPayload, user } = await issueTokensForUser(found, res);

    res.json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: accessPayload.roles,
        hotel: user.hotel
          ? { id: user.hotel._id, name: user.hotel.name }
          : null,
        company: user.company
          ? { id: user.company._id, name: user.company.name }
          : null,
        firstLogin: user.firstLogin,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Login error" });
  }
};








// ============ REFRESH TOKEN ============
export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    console.log("🔁 [REFRESH] cookie.refreshToken =", token);

    if (!token) {
      return res.status(401).json({ error: "No refresh token" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      console.log("🔁 [REFRESH] payload =", payload);
    } catch (e) {
      console.error("🔁 [REFRESH] invalid token:", e.message);
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
      });
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    const userId = payload.sub || payload.id;
    const user = await User.findById(userId);
    console.log("🔁 [REFRESH] user from DB =", user && user._id);

    if (!user) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
      });
      return res
        .status(401)
        .json({ error: "User not found for refresh token" });
    }

    const exists =
      Array.isArray(user.refreshTokens) &&
      user.refreshTokens.some((t) => t.token === token);

    if (!exists) {
      console.warn("🔁 [REFRESH] token not in user.refreshTokens");
      res.clearCookie("refreshToken", refreshCookieOptions);
      return res
        .status(403)
        .json({ error: "Refresh token not recognized" });
    }

    //  1) Mỗi lần refresh -> tăng version
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    //  2) accessToken mới mang version MỚI
    const accessPayload = {
      sub: user._id.toString(),
      tokenVersion: user.tokenVersion,
      roles: (user.roles || []).map((r) => String(r).toUpperCase()),
      company: user.company || null,
      hotel: user.hotel || null,
    };

    const newAccessToken = jwt.sign(accessPayload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES,
    });

    console.log(
      "🔁 [REFRESH] new accessToken issued for",
      user._id,
      "version =",
      user.tokenVersion
    );
    return res.json({ accessToken: newAccessToken });
  } catch (e) {
    console.error("🔁 [REFRESH] unexpected error:", e);
    res.status(500).json({ error: "Refresh failed" });
  }
};

// OPTIONAL: test
export const ok = async (req, res) => {
  console.log("👉 /auth/ok cookies:", req.cookies);
  return res.json({ message: "OK", cookies: req.cookies });
};


// ============ GOOGLE CALLBACK ============
// sẽ được dùng trong route /api/auth/google/callback
// export const googleCallbackHandler = async (req, res) => {
//   try {
//     // req.user do passport-google set
//     const googleUser = req.user;
    

//     const { accessToken } = await issueTokensForUser(googleUser, res);
//     console.log("Google login accessToken:", accessToken);

//     const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
//     return res.redirect(`${clientUrl}/auth/success?token=${accessToken}`);
//   } catch (e) {
//     console.error("Google callback error:", e);
//     const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
//     return res.redirect(`${clientUrl}/auth/error?reason=server_error`);
//   }
// };



export const googleCallbackHandler = async (req, res) => {
  try {
    const googleUser = req.user;

    const { accessToken, user } = await issueTokensForUser(googleUser, res);

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    

    // Chỉ gửi các trường cần thiết ra FE
    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      roles: user.roles || [],
      hotel: user.hotel
        ? { id: user.hotel._id, name: user.hotel.name }
        : null,
      company: user.company
        ? { id: user.company._id, name: user.company.name }
        : null,
      firstLogin: user.firstLogin,  
    };

    const encodedUser = encodeURIComponent(JSON.stringify(safeUser));

    // 👉 redirect về FE, kèm token + user trên query
    return res.redirect(
      `${clientUrl}/auth/success?token=${accessToken}&user=${encodedUser}`
    );
  } catch (e) {
    console.error("Google callback error:", e);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    return res.redirect(`${clientUrl}/auth/error?reason=server_error`);
  }
};
