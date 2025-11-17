import mongoose from "mongoose";
import { ROLE } from "../constants/roles.js";
import { Hotel } from "../models/Hotel.js";

const isAdmin = (u) => (u?.roles || []).some(r => String(r).toUpperCase() === ROLE.ADMIN);
const isAdminHotel = (u) => (u?.roles || []).some(r => String(r).toUpperCase() === ROLE.ADMIN_HOTEL);

/** Chỉ ADMIN hoặc ADMINHOTEL mới đi tiếp */
export function requireAdminOrAdminHotel(req, res, next) {
  
  if (isAdmin(req.user) || isAdminHotel(req.user)) return next();
 
  return res.status(403).json({ error: "Forbidden 3" });
}

/** Với ADMINHOTEL, bắt buộc có company gán trên user */
export function requireOwnCompanyOnCreate(req, res, next) {
  if (isAdmin(req.user)) return next();
  if (!isAdminHotel(req.user)) return res.status(403).json({ error: "Forbidden day" });
  if (!req.user.company) return res.status(400).json({ error: "Your account has no company assigned" });

  // ép company của payload = company của user
  req.body.company = String(req.user.company);
  next();
}

/** Kiểm tra quyền trên 1 hotel cụ thể theo :id */
export async function enforceHotelOwnership(req, res, next) {
  try {
    if (isAdmin(req.user)) return next(); // ADMIN qua thẳng

    if (!isAdminHotel(req.user)) return res.status(403).json({ error: "Forbidden" });
    if (!req.user.company) return res.status(400).json({ error: "Your account has no company assigned" });

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid hotel id" });
    }

    const hotel = await Hotel.findById(req.params.id).lean();
    if (!hotel || hotel.isDelete) return res.status(404).json({ error: "Hotel not found" });

    if (String(hotel.company) !== String(req.user.company)) {
      return res.status(403).json({ error: "Forbidden: hotel is not in your company" });
    }
    next();
  } catch (e) { next(e); }
}
