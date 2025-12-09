import { Booking, BOOKING_STATUS } from "../models/Booking.js";
import { Hotel } from "../models/Hotel.js";
import { Room } from "../models/Room.js";
import { staffCreateBookingSchema, addPaymentSchema, queryRangeSchema } from "../validations/booking.validation.js";
import { ROLE } from "../constants/roles.js";
import Review from "../models/Review.js";

// ——— Helpers quyền
const roleNames = (req) => (req.user?.roles || []).map(r => String(r).toUpperCase());
const isStaff       = (req) => roleNames(req).includes(ROLE.STAFF);
const isAdminHotel  = (req) => roleNames(req).includes(ROLE.ADMIN_HOTEL);
const isAdmin       = (req) => roleNames(req).includes(ROLE.ADMIN);

// ——— Helpers nghiệp vụ
const computeStatus = (amount, paid) => {
  if ((paid || 0) <= 0) return BOOKING_STATUS.PENDING;
  if (paid < amount)    return BOOKING_STATUS.PARTIAL;
  return BOOKING_STATUS.PAID;
};

const nightsBetween = (a, b) => {
  const d1 = new Date(a); const d2 = new Date(b);
  const ms = d2.setHours(12,0,0,0) - d1.setHours(12,0,0,0);
  return Math.max(1, Math.ceil(ms / 86400000));
};

// Kiểm tra phòng thuộc KS & trống lịch
async function assertRoomsBelongToHotelAndFree(hotelId, roomEntries, start, end, ignoredBookingId = null) {
  const roomIds = roomEntries.map(r => r.room);
  const countInHotel = await Room.countDocuments({ _id: { $in: roomIds }, hotel: hotelId });
  if (countInHotel !== roomIds.length) {
    throw new Error("Some rooms do not belong to this hotel");
  }

  // check overlap
  const clash = await Booking.exists({
    isDeleted: false,
    hotel: hotelId,
    status: { $nin: [BOOKING_STATUS.CANCELLED] },
    ...(ignoredBookingId ? { _id: { $ne: ignoredBookingId } } : {}),
    $or: [{ start_day: { $lt: end }, end_day: { $gt: start } }],
    "rooms.room": { $in: roomIds },
  });
  if (clash) throw new Error("One or more selected rooms are not available in the given dates");
}

// ——— API: tạo booking tại quầy (STAFF/ADMINHOTEL/ADMIN)
export const create = async (req, res, next) => {
  try {
    if (!(isStaff(req) || isAdminHotel(req) || isAdmin(req))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { value, error } = staffCreateBookingSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.message });

    // STAFF chỉ được tạo trong KS của mình
    if (isStaff(req)) {
      if (!req.user.hotel || String(req.user.hotel) !== String(value.hotel)) {
        return res.status(403).json({ error: "You can only book for your assigned hotel" });
      }
    }

    const hotel = await Hotel.findById(value.hotel).select("company");
    if (!hotel) return res.status(404).json({ error: "Hotel not found" });

    // ADMINHOTEL chỉ trong company của mình
    if (isAdminHotel(req) && String(hotel.company || "") !== String(req.user.company || "")) {
      return res.status(403).json({ error: "Hotel not in your company" });
    }

    const start = new Date(value.start_day);
    const end   = new Date(value.end_day);
    if (!(end > start)) {
      return res.status(400).json({ error: "end_day must be after start_day" });
    }

    await assertRoomsBelongToHotelAndFree(value.hotel, value.rooms, start, end);

    // Nếu muốn BE tự tính amount: bỏ comment 3 dòng dưới
    // const nights = nightsBetween(start, end);
    // const amount = value.rooms.reduce((s, it) => s + it.price * nights, 0);
    // if (amount !== value.amount) { /* tuỳ chọn sửa value.amount = amount; */ }

    const paid = Math.min(value.deposit || 0, value.amount);
    const status = computeStatus(value.amount, paid);

    const booking = await Booking.create({
      hotel: value.hotel,
      company: hotel.company || undefined,
      customer: value.customer,
      rooms: value.rooms,          // [{ room, price }]
      start_day: start,
      end_day: end,
      amount: value.amount,
      paid,
      status,
      createdBy: req.user._id,
      note: value.note || "",
      payments: paid > 0 ? [{
        method: "OFFLINE_CASH",
        amount: paid,
        note: "Deposit at counter",
        by: req.user._id,
      }] : [],
    });

    const out = await Booking.findById(booking._id)
      .populate("hotel", "name")
      .populate("rooms.room", "name number")
      .populate("createdBy", "name")
      .lean();

    res.status(201).json(out);
  } catch (e) {
    if (e?.message) return res.status(400).json({ error: e.message });
    next(e);
  }
};

// ——— API: thêm thanh toán offline
export const addPayment = async (req, res, next) => {
  try {
    const { value, error } = addPaymentSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const b = await Booking.findById(req.params.id);
    if (!b || b.isDeleted) return res.status(404).json({ error: "Booking not found" });

    if (isStaff(req) && String(b.hotel) !== String(req.user.hotel)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const remaining = Math.max(0, b.amount - b.paid);
    if (value.amount > remaining) return res.status(400).json({ error: "Amount exceeds remaining balance" });

    b.paid += value.amount;
    b.payments.push({ ...value, by: req.user._id });
    b.status = computeStatus(b.amount, b.paid);
    await b.save();

    const out = await Booking.findById(b._id)
      .populate("rooms.room", "name number")
      .lean();

    res.json(out);
  } catch (e) { next(e); }
};

// ——— API: list booking theo khoảng ngày (KS bắt buộc)
export const list = async (req, res, next) => {
  try {
    const { value, error } = queryRangeSchema.validate(req.query, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.message });

    if (isStaff(req) && String(value.hotel) !== String(req.user.hotel)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const q = {
      isDeleted: false,
      hotel: value.hotel,
      start_day: { $lt: value.to },
      end_day:   { $gt: value.from },
    };
    if (value.status) q.status = value.status;
    if (value.room)   q["rooms.room"] = value.room;

    const data = await Booking.find(q)
      .populate("rooms.room", "name number")
      .populate("createdBy", "name")
      .sort({ start_day: 1 })
      .lean();

    res.json(data);
  } catch (e) { next(e); }
};

// ——— API: chi tiết booking
export const detail = async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id)
      .populate("hotel", "name")
      .populate("rooms.room", "name number")
      .populate("createdBy", "name")
      .lean();

    if (!b) return res.status(404).json({ error: "Booking not found" });
    if (isStaff(req) && String(b.hotel?._id || b.hotel) !== String(req.user.hotel)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(b);
  } catch (e) { next(e); }
};

// ——— API: huỷ booking (trước check-in)
export const cancel = async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id);
    if (!b || b.isDeleted) return res.status(404).json({ error: "Booking not found" });
    if (isStaff(req) && String(b.hotel) !== String(req.user.hotel)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if ([BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.CHECKED_OUT].includes(b.status)) {
      return res.status(400).json({ error: "Cannot cancel after check-in" });
    }
    b.status = BOOKING_STATUS.CANCELLED;
    await b.save();
    res.json({ message: "Cancelled", id: b._id, status: b.status });
  } catch (e) { next(e); }
};

// ——— API: check-in
export const checkIn = async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id);
    if (!b || b.isDeleted) return res.status(404).json({ error: "Booking not found" });
    if (isStaff(req) && String(b.hotel) !== String(req.user.hotel)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if ([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.CHECKED_OUT].includes(b.status)) {
      return res.status(400).json({ error: "Invalid state" });
    }
    b.status = BOOKING_STATUS.CHECKED_IN;
    await b.save();
    res.json({ message: "Checked in", id: b._id, status: b.status });
  } catch (e) { next(e); }
};

// ——— API: check-out (yêu cầu paid == amount)
export const checkOut = async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id);
    if (!b || b.isDeleted) return res.status(404).json({ error: "Booking not found" });
    if (isStaff(req) && String(b.hotel) !== String(req.user.hotel)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const due = Math.max(0, b.amount - b.paid);
    if (due > 0) return res.status(400).json({ error: "Cannot check out while balance due > 0" });
    b.status = BOOKING_STATUS.CHECKED_OUT;
    await b.save();
    res.json({ message: "Checked out", id: b._id, status: b.status });
  } catch (e) { next(e); }
};




/** SOFT DELETE: DELETE /api/reception/bookings/:id  (xóa mềm) */
export const softDelete = async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id);
    if (!b || b.isDeleted) return res.status(404).json({ error: "Booking not found" });

    if (isStaff(req) && String(b.hotel) !== String(req.user.hotel)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    b.isDeleted = true;
    b.deletedAt = new Date();
    await b.save();
    res.json({ message: "Booking soft-deleted", id: b._id });
  } catch (e) { next(e); }
};

/** RESTORE: PATCH /api/reception/bookings/:id/restore */
export const restore = async (req, res, next) => {
  try {
    const b = await Booking.findByIdWithDeleted(req.params.id);
    if (!b || !b.isDeleted) return res.status(404).json({ error: "Booking not found or not deleted" });

    if (isStaff(req) && String(b.hotel) !== String(req.user.hotel)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    b.isDeleted = false;
    b.deletedAt = null;
    await b.save();
    res.json({ message: "Booking restored", id: b._id });
  } catch (e) { next(e); }
};

/** UPDATE DATES: PATCH /api/reception/bookings/:id/dates {start_day,end_day, recalcAmount?} */
export const updateDates = async (req, res, next) => {
  try {
    const { start_day, end_day, recalcAmount } = req.body || {};
    if (!start_day || !end_day) return res.status(400).json({ error: "start_day & end_day are required" });

    const b = await Booking.findById(req.params.id);
    if (!b || b.isDeleted) return res.status(404).json({ error: "Booking not found" });
    if (isStaff(req) && String(b.hotel) !== String(req.user.hotel)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if ([BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.CHECKED_OUT].includes(b.status)) {
      return res.status(400).json({ error: "Cannot change dates after check-in" });
    }

    const start = new Date(start_day);
    const end   = new Date(end_day);
    if (!(end > start)) return res.status(400).json({ error: "end_day must be after start_day" });

    // kiểm tra trống cho toàn bộ rooms hiện có
    await assertRoomsBelongToHotelAndFree(b.hotel, b.rooms, start, end, b._id);

    b.start_day = start;
    b.end_day   = end;

    if (recalcAmount) {
      const nights = nightsBetween(start, end);
      const sum = b.rooms.reduce((s, it) => s + it.price * nights, 0);
      b.amount = sum;
      b.status = computeStatus(b.amount, b.paid);
    }

    await b.save();

    const out = await Booking.findById(b._id)
      .populate("rooms.room", "name number")
      .lean();

    res.json(out);
  } catch (e) {
    if (e?.message) return res.status(400).json({ error: e.message });
    next(e);
  }
};

/** CHANGE ROOMS: PATCH /api/reception/bookings/:id/rooms
 *  body: { add?: [{room,price}], remove?: [roomId], recalcAmount? }
 */
export const updateRooms = async (req, res, next) => {
  try {
    const { add = [], remove = [], recalcAmount } = req.body || {};
    const b = await Booking.findById(req.params.id);
    if (!b || b.isDeleted) return res.status(404).json({ error: "Booking not found" });
    if (isStaff(req) && String(b.hotel) !== String(req.user.hotel)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if ([BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.CHECKED_OUT].includes(b.status)) {
      return res.status(400).json({ error: "Cannot change rooms after check-in" });
    }

    // Xóa phòng
    if (Array.isArray(remove) && remove.length) {
      const rmSet = new Set(remove.map(String));
      b.rooms = b.rooms.filter(it => !rmSet.has(String(it.room)));
    }

    // Thêm phòng (kiểm tra thuộc KS & trống)
    if (Array.isArray(add) && add.length) {
      await assertRoomsBelongToHotelAndFree(b.hotel, add, b.start_day, b.end_day, b._id);
      // tránh trùng
      const existing = new Set(b.rooms.map(it => String(it.room)));
      for (const it of add) {
        if (!existing.has(String(it.room))) {
          b.rooms.push({ room: it.room, price: it.price });
        }
      }
    }

    if (recalcAmount) {
      const nights = nightsBetween(b.start_day, b.end_day);
      const sum = b.rooms.reduce((s, it) => s + it.price * nights, 0);
      b.amount = sum;
      b.status = computeStatus(b.amount, b.paid);
    }

    await b.save();

    const out = await Booking.findById(b._id)
      .populate("rooms.room", "name number")
      .lean();

    res.json(out);
  } catch (e) {
    if (e?.message) return res.status(400).json({ error: e.message });
    next(e);
  }
};





export const canReview = async (req, res) => {
  try {
    const { hotelId } = req.params;

    // Tìm booking đã checkout của user tại khách sạn đó
    const booking = await Booking.findOne({
      hotel: hotelId,
      user: req.user._id,
      status: "CHECKED_OUT", // tùy bạn đặt tên status
    }).sort({ check_out: -1 }); // lấy booking mới nhất

    if (!booking) {
      return res.json({ canReview: false, bookingId: null });
    }

    const existed = await Review.findOne({ booking: booking._id });
    if (existed) {
      return res.json({ canReview: false, bookingId: null });
    }

    res.json({ canReview: true, bookingId: booking._id });
  } catch (err) {
    console.error("canReview error:", err);
    res.status(500).json({ error: err.message });
  }
};



// ——— API: list booking theo company (cho ADMIN / ADMIN_HOTEL)
// GET /api/admin/bookings/company?from=2025-01-01&to=2025-01-31&status=PAID&hotel=<hotelId>&page=1&limit=20
export const listByCompany = async (req, res, next) => {
  try {
    const roles = roleNames(req);
    const isAdminRole = roles.includes(ROLE.ADMIN);
    const isAdminHotelRole = roles.includes(ROLE.ADMIN_HOTEL);

    if (!isAdminRole && !isAdminHotelRole) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Xác định companyId
    let companyId = null;

    if (isAdminRole) {
      // ADMIN tổng: phải truyền ?company=... vào query
      companyId = req.query.company || null;
      if (!companyId) {
        return res
          .status(400)
          .json({ error: "company query is required for admin" });
      }
    } else {
      // ADMIN_HOTEL: dùng company của user
      if (!req.user.company) {
        return res
          .status(400)
          .json({ error: "Your account has no company assigned" });
      }
      companyId = req.user.company;
    }

    // Parse khoảng ngày (optional)
    let from = req.query.from ? new Date(req.query.from) : null;
    let to = req.query.to ? new Date(req.query.to) : null;

    // Nếu không truyền from/to -> mặc định 30 ngày gần nhất
    if (!from && !to) {
      to = new Date();
      from = new Date();
      from.setDate(to.getDate() - 30);
    }

    const q = {
      isDeleted: false,
      company: companyId,
    };

    // Lọc theo khoảng ngày: overlap (tương tự hàm list)
    if (from) q.end_day = { ...(q.end_day || {}), $gt: from };
    if (to) q.start_day = { ...(q.start_day || {}), $lt: to };

    // Lọc theo status
    if (req.query.status) {
      q.status = req.query.status;
    }

    // Lọc theo hotel trong company đó
    if (req.query.hotel) {
      q.hotel = req.query.hotel;
    }

    // (Optional) search theo gì đó nếu bạn có trường customer_name / customerPhone
    if (req.query.q && req.query.q.trim()) {
      const rx = new RegExp(req.query.q.trim(), "i");
      // tùy schema của bạn mà chỉnh
      q.$or = [
        { "customer.name": rx },
        { "customer.phone": rx },
        { orderCode: rx },
      ];
    }

    // Phân trang
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "20", 10), 1),
      100
    );
    const skip = (page - 1) * limit;

    // Sắp xếp
    let sort = { start_day: -1 }; // mới nhất trước
    if (req.query.sort) {
      // ví dụ: sort=start_day:asc hoặc sort=amount:desc
      const [field, dirRaw] = String(req.query.sort).split(":");
      const dir = (dirRaw || "asc").toLowerCase() === "desc" ? -1 : 1;
      if (field) sort = { [field]: dir };
    }

    // Query & count
    const [items, total] = await Promise.all([
      Booking.find(q)
        .populate("hotel", "name")
        .populate("rooms.room", "name number")
        .populate("createdBy", "name")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(q),
    ]);

    const pages = Math.ceil(total / limit);

    return res.json({
      data: items,
      pagination: { page, limit, total, pages },
      sort,
      filters: {
        company: companyId,
        from: from?.toISOString() || null,
        to: to?.toISOString() || null,
        status: req.query.status || null,
        hotel: req.query.hotel || null,
        q: req.query.q || null,
      },
    });
  } catch (e) {
    next(e);
  }
};
