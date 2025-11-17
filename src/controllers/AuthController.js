import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { registerSchema, loginSchema } from "../validations/auth.validation.js";

const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

export const register =  async (req, res) => {
  try {
    const { value, error } = registerSchema.validate(req.body);
    console.log(value);
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


// export const login =async (req, res) => {
//   try {
//     const { value, error } = loginSchema.validate(req.body);
//     if (error) return res.status(400).json({ error: error.message });

//     const user = await User.findOne({ email: value.email });
//     if (!user) return res.status(401).json({ error: "Invalid credentials" });

//     const ok = await user.verifyPassword(value.password);
//     if (!ok) return res.status(401).json({ error: "Invalid credentials" });

//     const token = jwt.sign(
//       { sub: user._id.toString(), roles: user.roles },
//       process.env.JWT_SECRET,
//       { expiresIn: process.env.JWT_EXPIRES || "7d" }
//     );
//     res.json({ token });
//   } catch (e) {
//     res.status(400).json({ error: e.message });
//   }
// };


export const login = async (req, res) => {
  try {
    // 1) Validate input
    if (loginSchema) {
  const { value, error } = loginSchema.validate(req.body);
  if (error) {
    // Lấy lỗi đầu tiên
    const detail = error.details?.[0];

    let msg = detail?.message || error.message;

    // Tuỳ biến theo field
    if (detail?.path?.[0] === "email") {
      msg = "Email không hợp lệ. Vui lòng nhập đúng định dạng (vd: abc@gmail.com)";
    } else if (detail?.path?.[0] === "password") {
      msg = "Mật khẩu không được để trống";
    }

    return res.status(400).json({ error: msg });
  }
  req.body = value;
}


    const { email, password } = req.body;

    // 2) Tìm user theo email
    // (Nếu bạn cấu hình password_hash select:false thì cần .select("+password_hash"))
    const user = await User.findOne({ email })
      .populate("hotel", "name")     // chỉ cần _id + name
      .populate("company", "name");  // chỉ cần _id + name

    if (!user || user.isDeleted) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 3) Kiểm tra password
    const ok = await user.verifyPassword(password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // 4) Tạo JWT (payload nhẹ, không nhét cả user)
    // Lưu ý: roles của bạn đang là mảng string (["ADMIN",...])
    const payload = {
      sub: user._id.toString(),
      roles: (user.roles || []).map(r => String(r).toUpperCase()),
      // có thể thêm company/hotel để FE đọc nhanh:
      company: user.company?._id || null,
      hotel: user.hotel?._id || null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES });

    // 5) (Tuỳ chọn) đánh dấu firstLogin=false sau lần đầu
    const SHOULD_CLEAR_FIRST_LOGIN = false; // đổi true nếu muốn
    if (SHOULD_CLEAR_FIRST_LOGIN && user.firstLogin) {
      user.firstLogin = false;
      await user.save();
    }

    // 6) Trả về token + user info gọn gàng cho FE
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: (user.roles || []).map(r => String(r).toUpperCase()),
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
