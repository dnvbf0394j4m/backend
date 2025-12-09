import { User } from "../models/User.js";
import { ROLE } from "../constants/roles.js";
// import { max } from "moment";



export const getEmployees = async (req, res) => {
  try {
    const includeDeteded = req.query.includeDeleted === "1";
    const q = includeDeteded ? {} : { isDelete: false };

    const rolesUp = (req.user?.roles || []).map((r) => r.toUpperCase());
    const isAdmin = rolesUp.includes(ROLE.ADMIN);
    const isAdminHotel = rolesUp.includes(ROLE.ADMIN_HOTEL);

    if (!isAdmin && !isAdminHotel) {
      return res.status(403).json({ message: "Ban khong co quyen!" });
    }

    if (isAdmin) {
      if (req.query.company) {
        q.company = req.query.company;
      }
    } else {
      if (!req.user.company) {
        return res.status(400).json({ message: "User khong co cong ty!" });
      }
      q.company = req.user.company;
    }

    // Chỉ lấy nhân viên (STAFF)
    q.roles = ROLE.STAFF;

    // Tìm kiếm text: theo tên / email / sdt
    if (req.query.q && req.query.q.trim() !== "") {
      const rx = new RegExp(req.query.q.trim(), "i");
      q.$or = [
        { name: { $regex: rx } },
        { email: { $regex: rx } },
        { phone: { $regex: rx } },
      ];
    }

    // Phân trang
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    // ✅ SỬA Ở ĐÂY: giới hạn limit trong khoảng 1–100, mặc định 20
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Math.max(1, Math.min(100, isNaN(rawLimit) ? 20 : rawLimit));

    const skip = (page - 1) * limit;

    // Sắp xếp
    let sort = { createAt: -1 }; // nếu schema là createdAt thì sửa lại chỗ này
    if (req.query.sort) {
      const [field, dirRaw] = String(req.query.sort).split(":");
      const dir = (dirRaw || "asc").toLowerCase() === "desc" ? -1 : 1;
      if (field) sort = { [field]: dir };
    }

    // Thực hiện truy vấn
    const [items, total] = await Promise.all([
      User.find(q)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("-password_hash -refreshTokendens -tokenVersion")
        .populate("company", "name")
        .populate("hotel", "name")
        .lean(),
      User.countDocuments(q),
    ]);

    return res.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      sort,
      filters: {
        q: req.query.q || null,
        company: req.query.company || null,
        roles: ROLE.STAFF,
        includeDeteded,
      },
    });
  } catch (error) {
    console.error("Loi getEmployees:", error);
    return res.status(500).json({ message: "Loi server!" });
  }
};
