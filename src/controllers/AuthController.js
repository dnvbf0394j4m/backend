import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { registerSchema, loginSchema } from "../validations/auth.validation.js";

const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

export const register = async (req, res) => {
  try {
    const { value, error } = registerSchema.validate(req.body,{ stripUnknown: true });
    
    if (error) return res.status(400).json({ error: error.message });

    const exists = await User.findOne({ email: value.email });
    if (exists) return res.status(400).json({ error: "Email already in use" });

    const user = new User({ name: value.name, email: value.email, phone: value.phone, roles: ["USER"] });
    await user.setPassword(value.password);
    await user.save();

    res.status(201).json({ id: user._id, email: user.email });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};


// ❌ VÍ DỤ KHÔNG AN TOÀN
// export const register = async (req, res) => {
//   try {
    
//     const user = new User(req.body);   // <-- mass assignment
//     await user.setPassword(req.body.password);
//     await user.save();

//     res.status(201).json({ id: user._id, email: user.email, roles: user.roles });
//   } catch (e) {
//     res.status(400).json({ error: e.message });
//   }
// };



const ACCESS_EXPIRES = process.env.JWT_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "30d";

export const login = async (req, res) => {
  try {
    // validate như bạn đang làm
    const { value, error } = loginSchema.validate(req.body);
    if (error) { /* ... như cũ ... */ }

    const { email, password } = value;
    const user = await User.findOne({ email })
      .populate("hotel", "name")
      .populate("company", "name");
    if (!user || user.isDeleted) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await user.verifyPassword(password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // ---- 1) Tạo access token sống ngắn
    const accessPayload = {
      sub: user._id.toString(),
      roles: (user.roles || []).map(r => String(r).toUpperCase()),
      company: user.company?._id || null,
      hotel: user.hotel?._id || null,
    };

    const accessToken = jwt.sign(accessPayload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES,
    });

    // ---- 2) Tạo refresh token sống dài
    const refreshPayload = { sub: user._id.toString() };
    const refreshToken = jwt.sign(
      refreshPayload,
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_EXPIRES }
    );

    // Lưu refreshToken vào DB (để sau này có thể revoke)
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });
    await user.save();

    // ---- 3) Gửi refresh token bằng HTTP-Only Cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // lên https thì để true
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    // ---- 4) Trả access token + user info cho FE
    res.json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: accessPayload.roles,
        hotel: user.hotel ? { id: user.hotel._id, name: user.hotel.name } : null,
        company: user.company ? { id: user.company._id, name: user.company.name } : null,
        firstLogin: user.firstLogin,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Login error" });
  }
};


export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken; // lấy từ cookie
    if (!token) return res.status(401).json({ error: "No refresh token" });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (e) {
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(404).json({ error: "User not found" });

    const exists = (user.refreshTokens || []).some(t => t.token === token);
    if (!exists) {
      return res.status(403).json({ error: "Refresh token not recognized" });
    }

    const accessPayload = {
      sub: user._id.toString(),
      roles: (user.roles || []).map(r => String(r).toUpperCase()),
      company: user.company || null,
      hotel: user.hotel || null,
    };

    const newAccessToken = jwt.sign(
      accessPayload,
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_EXPIRES }
    );

    return res.json({ accessToken: newAccessToken });
  } catch (e) {
    console.error("Refresh error:", e);
    res.status(400).json({ error: "Refresh failed" });
  }
};

