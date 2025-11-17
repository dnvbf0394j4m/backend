// src/controllers/RoomsController.js
import { Room } from "../models/Room.js";
import { Hotel } from "../models/Hotel.js";
import { RoomImage } from "../models/RoomImage.js";
import { createRoomSchema, updateRoomSchema } from "../validations/room.validation.js";
import { ROLE } from "../constants/roles.js";
import { ROOM_STATUS } from "../models/Room.js";
import { Booking, BOOKING_STATUS } from "../models/Booking.js";

/** Chỉ ADMIN & ADMINHOTEL được tạo/sửa/xoá; STAFF có thể xem. */
function canWrite(req) {
  const roles = (req.user?.roles || []).map(r => String(r).toUpperCase());
  return roles.includes(ROLE.ADMIN) || roles.includes(ROLE.ADMIN_HOTEL);
}

function isAdminHotel(req) {
  const roles = (req.user?.roles || []).map(r => String(r).toUpperCase());
  return roles.includes(ROLE.ADMIN_HOTEL);
}

/** GET /api/rooms?hotel=...&q=...&status=...&page=1&limit=20 */
export const list = async (req, res, next) => {
  try {
    const { hotel, q, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (hotel) filter.hotel = hotel;
    if (status) filter.status = status;
    if (q) filter.name = { $regex: q, $options: "i" };

    // ADMINHOTEL chỉ xem được theo company của họ (nếu bạn muốn siết chặt hơn)
    // Ở đây cho phép truyền hotel cụ thể nên không ràng buộc company nữa.

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Room.find(filter)
        .populate("hotel", "name")
        .populate("roomImages", "image_url")
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Room.countDocuments(filter),
    ]);

    res.json({ data: items, page: Number(page), limit: Number(limit), total });
  } catch (e) { next(e); }
};

/** GET /api/rooms/:id */
export const detail = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate("hotel", "name")
      .populate("roomImages", "image_url")
      .lean();
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(room);
  } catch (e) { next(e); }
};

/** POST /api/rooms */


// ép kiểu số vì form-data là string
function toNum(v, fallback = undefined) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Parse `meta` (JSON string) hoặc lấy field phẳng
function parseMultipartBody(req) {
  if (typeof req.body?.meta === "string" && req.body.meta.trim().startsWith("{")) {
    try { return JSON.parse(req.body.meta); }
    catch { throw new Error("Invalid meta JSON"); }
  }
  // field phẳng từ form-data
  const b = { ...req.body };
  // ép kiểu số cho những field numeric
  if (b.price !== undefined) b.price = toNum(b.price);
  if (b.basePrice !== undefined) b.basePrice = toNum(b.basePrice);
  if (b.max_guests !== undefined) b.max_guests = toNum(b.max_guests);
  if (b.size_sqm !== undefined) b.size_sqm = toNum(b.size_sqm);
  return b;
}
export const createWithImages = async (req, res, next) => {
  try {
    // 1) Lấy payload
    let body;
    try {
      body = parseMultipartBody(req);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // 2) Validate
    const { value, error } = createRoomSchema.validate(body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.message });

    // 3) Kiểm tra Hotel + ràng buộc ADMIN_HOTEL theo company
    const hotel = await Hotel.findById(value.hotel).select("company").lean();
    if (!hotel) return res.status(404).json({ error: "Hotel not found" });

    if (isAdminHotel(req) && String(hotel.company || "") !== String(req.user.company || "")) {
      return res.status(403).json({ error: "Hotel not in your company" });
    }

    // 4) Tạo Room
    const room = await Room.create({
      hotel: value.hotel,
      name: value.name,
      description: value.description ?? "",
      price: value.price,
      basePrice: value.basePrice ?? undefined,
      max_guests: value.max_guests ?? 1,
      beds: value.beds ?? "",
      size_sqm: value.size_sqm ?? undefined,
      status: value.status ?? "AVAILABLE",
    });

    await Hotel.findByIdAndUpdate(
      value.hotel,
      { $addToSet: { room: room._id } },
      { new: false }
    );

    // 5) Lưu ảnh nếu có
    const createdImageIds = [];
    for (const f of (req.files || [])) {
      const url = `/uploads/rooms/${f.filename}`; // nhớ app.use("/uploads", express.static("uploads"))
      const img = await RoomImage.create({ image_url: url, room: room._id });
      createdImageIds.push(img._id);
    }
    if (createdImageIds.length) {
      room.roomImages.push(...createdImageIds);
      await room.save();
    }


    // 6) Trả về đã populate
    const out = await Room.findById(room._id)
      .populate("hotel", "name")
      .populate("roomImages", "image_url")
      .lean();

    res.status(201).json(out);
  } catch (e) { next(e); }
};

/** PUT /api/rooms/:id */
export const update = async (req, res, next) => {
  try {
    if (!canWrite(req)) return res.status(403).json({ error: "Forbidden" });

    const { value, error } = updateRoomSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.message });

    const room = await Room.findById(req.params.id);
    if (!room || room.isDeleted) return res.status(404).json({ error: "Room not found" });

    // ADMINHOTEL chỉ được sửa phòng thuộc công ty họ
    if (isAdminHotel(req)) {
      const hotel = await Hotel.findById(room.hotel).select("company").lean();
      if (!hotel || String(hotel.company || "") !== String(req.user.company || "")) {
        return res.status(403).json({ error: "Room not in your company" });
      }
    }

    Object.assign(room, value);
    await room.save();

    const out = await Room.findById(room._id)
      .populate("hotel", "name")
      .populate("roomImages", "image_url")
      .lean();

    res.json(out);
  } catch (e) { next(e); }
};

/** DELETE /api/rooms/:id   (soft delete)  |  DELETE ...?force=1 để xoá hẳn */
export const remove = async (req, res, next) => {
  try {
    if (!canWrite(req)) return res.status(403).json({ error: "Forbidden" });

    const force = req.query.force === "1";
    if (force) {
      const del = await Room.findByIdAndDelete(req.params.id).lean();
      if (!del) return res.status(404).json({ error: "Room not found" });
      return res.json({ message: "Room permanently deleted", id: del._id });
    }

    const room = await Room.findById(req.params.id);
    if (!room || room.isDeleted) return res.status(404).json({ error: "Room not found" });

    room.isDeleted = true;
    room.deletedAt = new Date();
    await room.save();

    res.json({ message: "Room soft-deleted", id: room._id });
  } catch (e) { next(e); }
};

/** PATCH /api/rooms/:id/restore */
export const restore = async (req, res, next) => {
  try {
    if (!canWrite(req)) return res.status(403).json({ error: "Forbidden" });

    const room = await Room.findById(req.params.id);
    if (!room || !room.isDeleted) return res.status(404).json({ error: "Room not found or not deleted" });

    room.isDeleted = false;
    room.deletedAt = null;
    await room.save();

    const out = await Room.findById(room._id)
      .populate("hotel", "name")
      .populate("roomImages", "image_url")
      .lean();

    res.json({ message: "Room restored", room: out });
  } catch (e) { next(e); }
};

/** POST /api/rooms/:id/images  (upload ảnh phòng) */
export const addImages = async (req, res, next) => {
  try {
    if (!canWrite(req)) return res.status(403).json({ error: "Forbidden" });

    const room = await Room.findById(req.params.id);
    if (!room || room.isDeleted) return res.status(404).json({ error: "Room not found" });

    // ADMINHOTEL bảo vệ phạm vi công ty
    if (isAdminHotel(req)) {
      const hotel = await Hotel.findById(room.hotel).select("company").lean();
      if (!hotel || String(hotel.company || "") !== String(req.user.company || "")) {
        return res.status(403).json({ error: "Room not in your company" });
      }
    }

    const created = [];
    for (const f of (req.files || [])) {
      const url = `/uploads/rooms/${f.filename}`;
      const img = await RoomImage.create({ image_url: url, room: room._id });
      created.push(img._id);
    }

    if (created.length) {
      room.roomImages.push(...created);
      await room.save();
    }

    const out = await Room.findById(room._id).populate("roomImages", "image_url").lean();
    res.status(201).json(out);
  } catch (e) { next(e); }
};

/** DELETE /api/rooms/:id/images/:imageId (xóa 1 ảnh khỏi phòng) */
export const removeImage = async (req, res, next) => {
  try {
    if (!canWrite(req)) return res.status(403).json({ error: "Forbidden" });

    const room = await Room.findById(req.params.id);
    if (!room || room.isDeleted) return res.status(404).json({ error: "Room not found" });

    const img = await RoomImage.findById(req.params.imageId);
    if (!img || String(img.room) !== String(room._id)) {
      return res.status(404).json({ error: "Image not found in this room" });
    }

    // Bỏ tham chiếu trong room
    room.roomImages = room.roomImages.filter(id => String(id) !== String(img._id));
    await room.save();

    // (Tuỳ bạn) Có thể xoá file vật lý tại /uploads/rooms/... nếu muốn
    await img.deleteOne();

    res.json({ message: "Image removed", imageId: req.params.imageId });
  } catch (e) { next(e); }
};




export const listAvailableRooms = async (req, res, next) => {
  try {
    const { hotelId } = req.params;
    const { start_day, end_day, adults, children } = req.query;

    if (!hotelId) {
      return res.status(400).json({ error: "Missing hotelId" });
    }
    if (!start_day || !end_day) {
      return res
        .status(400)
        .json({ error: "start_day và end_day là bắt buộc" });
    }

    const start = new Date(start_day);
    const end = new Date(end_day);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res
        .status(400)
        .json({ error: "start_day hoặc end_day không hợp lệ" });
    }
    if (end <= start) {
      return res.status(400).json({ error: "end_day phải sau start_day" });
    }

    const adultsNum = Number(adults ?? 1);
    const childrenNum = Number(children ?? 0);
    const totalGuests = adultsNum + childrenNum;

    // 1) Tìm các booking bị trùng thời gian với khoảng [start, end)
    const overlappingBookings = await Booking.find({
      hotel: hotelId,
      isDeleted: false,
      status: { $nin: [BOOKING_STATUS.CANCELLED] }, // bỏ booking đã hủy
      start_day: { $lt: end },
      end_day: { $gt: start },
    })
      .select("rooms.room")
      .lean();

    // 2) Gom các roomId đã được đặt
    const bookedRoomIds = new Set();
    for (const b of overlappingBookings) {
      for (const item of b.rooms || []) {
        if (item.room) {
          bookedRoomIds.add(String(item.room));
        }
      }
    }

    // 3) Query phòng còn trống
    const query = {
      hotel: hotelId,
      // Soft-delete: middleware đã tự thêm isDeleted: false
      status: {
        // không cho book phòng bảo trì / out of service
        $nin: [ROOM_STATUS.MAINTENANCE, ROOM_STATUS.OUT_OF_SERVICE],
      },
    };

    if (totalGuests > 0) {
      query.max_guests = { $gte: totalGuests };
    }

    if (bookedRoomIds.size > 0) {
      query._id = { $nin: [...bookedRoomIds] };
    }

    const rooms = await Room.find(query)
      .select(
        "name description price basePrice max_guests beds size_sqm status"
      )
      .lean();

    return res.json({
      hotel: hotelId,
      start_day: start,
      end_day: end,
      guests: {
        adults: adultsNum,
        children: childrenNum,
        total: totalGuests,
      },
      rooms,
    });
  } catch (err) {
    next(err);
  }
};
