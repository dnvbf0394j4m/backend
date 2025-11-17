// src/utils/hotelPermission.js
import { ROLE } from "../constants/roles.js";
import { Hotel } from "../models/Hotel.js";

const rolesOf = (req) => (req.user?.roles || []).map(r => String(r).toUpperCase());
const isStaff      = (req) => rolesOf(req).includes(ROLE.STAFF);
const isAdminHotel = (req) => rolesOf(req).includes(ROLE.ADMIN_HOTEL) || rolesOf(req).includes(ROLE.ADMINHOTEL);
const isAdmin      = (req) => rolesOf(req).includes(ROLE.ADMIN);

/**
 * Đảm bảo user có quyền thao tác trên hotelId
 * - STAFF   : req.user.hotel phải bằng hotelId
 * - ADMIN_HOTEL: req.user.company == hotel.company
 * - ADMIN   : tự do
 * Trả về document Hotel nếu ok, nếu không -> throw Error("Forbidden...")
 */
export async function assertHotelPermission(req, hotelId) {
  const hotel = await Hotel.findById(hotelId).lean();
  if (!hotel) throw new Error("Hotel not found");

  if (isStaff(req)) {
    if (!req.user?.hotel || String(req.user.hotel) !== String(hotel._id)) {
      throw new Error("Forbidden: staff can only operate on own hotel");
    }
  } else if (isAdminHotel(req)) {
    if (!req.user?.company || String(req.user.company) !== String(hotel.company)) {
      throw new Error("Forbidden: admin_hotel must be in same company");
    }
  } else if (!isAdmin(req)) {
    throw new Error("Forbidden");
  }

  return hotel;
}
