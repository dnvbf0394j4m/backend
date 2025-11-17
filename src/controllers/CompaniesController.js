import { Company } from "../models/Company.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { createCompanySchema, updateCompanySchema } from "../validations/company.validation.js";
import { Hotel } from "../models/Hotel.js";
import {
  createStaffSchema, // nhớ tạo schema này trong user.validation.js
} from "../validations/user.validation.js";
import { User } from "../models/User.js";

/**
 * GET /api/companies
 * ?q=keyword  -> search theo name/email (regex)
 * ?limit=...&page=... -> phân trang cơ bản
 */

const rolesOf = (req) =>
  (req.user?.roles || []).map((r) => String(r.name || r).toUpperCase());

export const list = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (q && q.trim()) {
      const rx = new RegExp(q.trim(), "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const lmt = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * lmt;

    const [items, total] = await Promise.all([
      Company.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lmt)
        .populate("items", "name email")   // users
        .populate("hotels", "name address")// hotels
        .lean(),
      Company.countDocuments(filter),
    ]);

    res.json({
      data: items,
      pagination: { page: Number(page), limit: lmt, total, pages: Math.ceil(total / lmt) }
    });
  } catch (e) { next(e); }
};

/** GET /api/companies/:id */
export const detail = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate("items", "name email")
      .populate("hotels", "name address")
      .lean();
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json(company);
  } catch (e) { next(e); }
};

/** POST /api/companies */
/**
 * POST /api/companies/with-admin
 * Tạo công ty + user admin mặc định
 */
// export const createWithAdmin = async (req, res, next) => {
//   const session = await Company.startSession();
//   session.startTransaction();

//   try {
//     const { value, error } = createCompanySchema.validate(req.body);
//     if (error) return res.status(400).json({ error: error.message });

//     const { name, email, phone, address, company_type, adminName, adminEmail } = value;

//     // 1️⃣ Tạo công ty
//     const newCompany = new Company({
//       name,
//       email: email || adminEmail,
//       phone,
//       address,
//       company_type,
//     });
//     const savedCompany = await newCompany.save({ session });

//     // 2️⃣ Sinh mật khẩu ngẫu nhiên
//     const rawPassword = generateRandomPassword(10);
//     const hashedPassword = await bcrypt.hash(rawPassword, 10);

//     // 3️⃣ Tạo user admin cho công ty
//     const adminUser = new User({
//       name: adminName || "Admin",
//       email: adminEmail,
//       password_hash: hashedPassword,
//       phone,
//       company: savedCompany._id,
//       roles: [ROLE.ADMINHOTEL, ROLE.USER], // hoặc ROLE.ADMIN tùy bạn
//       firstLogin: true,
//     });
//     await adminUser.save({ session });

//     // 4️⃣ Gửi email thông báo mật khẩu
//     await sendPasswordEmail(adminEmail, rawPassword);

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       message: "Company and admin created successfully",
//       company: {
//         id: savedCompany._id,
//         name: savedCompany.name,
//         email: savedCompany.email,
//       },
//       admin: {
//         id: adminUser._id,
//         email: adminUser.email,
//       },
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     next(err);
//   }
// };

// // 🧩 Helper: Sinh mật khẩu ngẫu nhiên
// function generateRandomPassword(length = 10) {
//   const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
//   let password = "";
//   for (let i = 0; i < length; i++) {
//     const randomIndex = crypto.randomInt(0, chars.length);
//     password += chars[randomIndex];
//   }
//   return password;
// }

// // 🧩 Helper: Gửi email
// async function sendPasswordEmail(to, password) {
//   // Cấu hình SMTP
//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL_USER, // ví dụ: "doanvanlong2x2@gmail.com"
//       pass: process.env.EMAIL_PASS, // app password
//     },
//   });

//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to,
//     subject: "Tài khoản quản trị công ty của bạn",
//     html: `
//       <p>Xin chào,</p>
//       <p>Mật khẩu tạm thời của bạn là: <b>${password}</b></p>
//       <p>Vui lòng đổi mật khẩu sau khi đăng nhập lần đầu.</p>
//     `,
//   };

//   await transporter.sendMail(mailOptions);
// }


// lưu ý roles của bạn là String: "ADMIN_HOTEL", "USER", ...
const ROLE = { ADMIN_HOTEL: "ADMIN_HOTEL", USER: "USER" ,STAFF:"STAFF", ADMIN: "ADMIN" };

export const createWithAdmin = async (req, res, next) => {
  let savedCompany = null;
  try {
    const { value, error } = createCompanySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const { name, email, phone, address, company_type, adminName, adminEmail } = value;

    // 1) Tạo công ty
    const newCompany = new Company({
      name,
      email: email || adminEmail,
      phone,
      address,
      company_type,
    });
    savedCompany = await newCompany.save();

    // 2) Sinh & hash mật khẩu
    const rawPassword = generateRandomPassword(10);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // 3) Tạo user admin cho công ty
    const adminUser = await User.create({
      name: adminName || "Admin",
      email: adminEmail,
      password_hash: hashedPassword,
      phone,
      company: savedCompany._id,
      roles: [ROLE.ADMIN_HOTEL, ROLE.USER], // CHUỖI, đúng theo schema của bạn
      firstLogin: true,
    });

    // 4) Gửi email (có thể cho vào queue/background nếu cần)
    await sendPasswordEmail(adminEmail, rawPassword);

    return res.status(201).json({
      message: "Company and admin created successfully",
      company: { id: savedCompany._id, name: savedCompany.name, email: savedCompany.email },
      admin: { id: adminUser._id, email: adminUser.email },
    });
  } catch (err) {
    // Rollback thủ công nếu user tạo thất bại nhưng company đã tạo
    if (savedCompany) {
      try { await Company.deleteOne({ _id: savedCompany._id }); } catch {}
    }
    return next(err);
  }
};


export const createStaff = async (req, res, next) => {
  try {
    // 1) Check quyền
    const roles = rolesOf(req);
    const isAdmin = roles.includes(ROLE.ADMIN);
    const isAdminHotel = roles.includes(ROLE.ADMIN_HOTEL);

    if (!isAdmin && !isAdminHotel) {
      return res.status(403).json({ error: "Forbidden: not allowed" });
    }

    // 2) Validate body
    const { value, error } = createStaffSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const { name, email, phone, hotelId } = value;

    // 3) Check hotel tồn tại
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) return res.status(404).json({ error: "Hotel not found" });

    // 4) Nếu là ADMIN_HOTEL → chỉ được tạo staff trong company của mình
    if (isAdminHotel) {
      if (String(hotel.company) !== String(req.user.company)) {
        return res.status(403).json({ error: "Cannot assign staff to hotel of other company" });
      }
    }

    // 5) Check email có tồn tại chưa
    const existed = await User.findOne({ email });
    if (existed) return res.status(400).json({ error: "Email already in use" });

    // 6) Sinh mật khẩu
    const rawPassword = generateRandomPassword(10);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // 7) Tạo nhân viên
    const staff = await User.create({
      name,
      email,
      phone,
      password_hash: hashedPassword,
      company: hotel.company,    // nhân viên thuộc công ty của hotel
      hotel: hotel._id,          // assign hotel duy nhất
      roles: [ROLE.STAFF, ROLE.USER],
      firstLogin: true,
    });

    // 8) Gửi email
    try {
      await sendPasswordEmail(email, rawPassword);
    } catch (e) {
      console.log("Email error:", e.message);
      // không rollback user, nhưng báo lỗi mail
    }

    // 9) Thêm nhân viên vào danh sách employees trong hotel
    hotel.employees.push(staff._id);
    await hotel.save();

    return res.status(201).json({
      message: "Staff created successfully",
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        hotel: staff.hotel,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Helpers
function generateRandomPassword(length = 10) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  let password = "";
  for (let i = 0; i < length; i++) password += chars[crypto.randomInt(0, chars.length)];
  return password;
}

async function sendPasswordEmail(to, password) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }, // app password
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Tài khoản quản trị công ty của bạn",
    html: `<p>Xin chào,</p><p>Mật khẩu tạm thời: <b>${password}</b></p><p>Vui lòng đổi sau khi đăng nhập lần đầu.</p>`,
  });
}


/** PUT/PATCH /api/companies/:id */
export const update = async (req, res, next) => {
  try {
    const { value, error } = updateCompanySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    // Whitelist fields để tránh mass assignment
    const allowed = ["name", "email", "phone", "address", "company_type"];
    const safeValue = Object.fromEntries(
      Object.entries(value).filter(([k]) => allowed.includes(k))
    );

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { $set: safeValue },
      { new: true }
    );

    if (!company) return res.status(404).json({ error: "Company not found" });

    res.json({ message: "Company updated", company });
  } catch (e) {
    next(e);
  }
};


/** DELETE /api/companies/:id  (xóa hẳn) */
export const remove = async (req, res, next) => {
  try {
    const r = await Company.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: "Company not found" });
    res.json({ message: "Company deleted", id: r._id });
  } catch (e) { next(e); }
};



export const resetStaffPassword = async (req, res, next) => {
  try {
    // 1) Check quyền
    const roles = rolesOf(req);
    const isAdmin = roles.includes(ROLE.ADMIN);
    const isAdminHotel = roles.includes(ROLE.ADMIN_HOTEL);

    if (!isAdmin && !isAdminHotel) {
      return res.status(403).json({ error: "Forbidden: not allowed" });
    }

    // 2) Lấy id nhân viên từ URL /.../staff/:id/reset-password
    const { id } = req.params;

    // 3) Tìm user
    const staff = await User.findById(id);
    if (!staff) {
      return res.status(404).json({ error: "Staff not found" });
    }

    // 4) Đảm bảo đây là nhân viên (có role STAFF)
    const staffRoles = (staff.roles || []).map((r) => String(r).toUpperCase());
    if (!staffRoles.includes(ROLE.STAFF)) {
      return res.status(400).json({ error: "User is not a staff" });
    }

    // 5) Nếu là ADMIN_HOTEL → chỉ được reset cho nhân viên trong company của mình
    if (isAdminHotel) {
      if (String(staff.company) !== String(req.user.company)) {
        return res.status(403).json({
          error: "Cannot reset password for staff of other company",
        });
      }
    }

    // 6) Sinh mật khẩu mới + hash
    const rawPassword = generateRandomPassword(10);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    staff.password_hash = hashedPassword;
    staff.firstLogin = true; // để lần đầu login bắt đổi mật khẩu nếu bạn có logic này
    await staff.save();

    // 7) Gửi email mật khẩu mới
    let emailError = null;
    try {
      await sendPasswordEmail(staff.email, rawPassword);
    } catch (e) {
      console.log("Email error:", e.message);
      emailError = e.message;
      // không rollback password, chỉ báo lỗi gửi mail
    }

    return res.status(200).json({
      message: emailError
        ? "Password reset, but failed to send email"
        : "Password reset successfully",
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
      },
      emailError,
    });
  } catch (err) {
    return next(err);
  }
};
