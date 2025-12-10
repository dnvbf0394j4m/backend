import mongoose from "mongoose";
import { Hotel } from "../models/Hotel.js";
import { Room } from "../models/Room.js";
import { HotelImage } from "../models/HotelImage.js";
import { createHotelSchema, updateHotelSchema } from "../validations/hotel.validation.js";
import { ROLE } from "../constants/roles.js";
import { Booking, BOOKING_STATUS } from "../models/Booking.js";
import fs from "fs";

const toDecimal128 = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const s = typeof v === "number" ? v.toFixed(2) : String(v);
  return mongoose.Types.Decimal128.fromString(s);
};

// GET /api/hotels?includeDeleted=1&company=<id>
// export const list = async (req, res, next) => {
//   try {
//     const includeDeleted = req.query.includeDeleted === "1";
//     const q = includeDeleted ? {} : { isDelete: false };

//     const isAdmin = (req.user?.roles || []).map(r=>String(r).toUpperCase()).includes(ROLE.ADMIN);
//     const isAdminHotel = (req.user?.roles || []).map(r=>String(r).toUpperCase()).includes(ROLE.ADMINHOTEL);

//     if (isAdmin) {
//       if (req.query.company) q.company = req.query.company;
//     } else if (isAdminHotel) {
//       if (!req.user.company) return res.status(400).json({ error: "Your account has no company assigned" });
//       q.company = req.user.company;
//     } else {
//       return res.status(403).json({ error: "Forbidden" });
//     }

//     const hotels = await Hotel.find(q)
//       .populate("company", "name")
//       .populate("city", "name")
//       .populate("area", "name")
//       .lean();

//     res.json(hotels);
//   } catch (e) { next(e); }
// };

export const list = async (req, res, next) => {
  try {
    const includeDeleted = req.query.includeDeleted === "1";
    const q = includeDeleted ? {} : { isDelete: false };

    // Phân quyền phạm vi
    const rolesUp = (req.user?.roles || []).map((r) => String(r).toUpperCase());
    const isAdmin = rolesUp.includes(ROLE.ADMIN);
    const isAdminHotel = rolesUp.includes(ROLE.ADMIN_HOTEL);


    if (!isAdmin && !isAdminHotel) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (isAdmin) {
      if (req.query.company) q.company = req.query.company;
    } else {
      // ADMINHOTEL
      if (!req.user.company) {
        return res.status(400).json({ error: "Your account has no company assigned" });
      }
      q.company = req.user.company;
    }

    // Tìm kiếm text
    if (req.query.q && req.query.q.trim()) {
      const rx = new RegExp(req.query.q.trim(), "i");
      q.$or = [{ name: rx }, { address: rx }];
    }

    // Lọc theo city/area
    if (req.query.city) q.city = req.query.city;
    if (req.query.area) q.area = req.query.area;

    // Lọc theo priceHotel (Decimal128)
    const minP = toDecimal128(req.query.minPrice);
    const maxP = toDecimal128(req.query.maxPrice);
    if (minP || maxP) {
      q.priceHotel = {};
      if (minP) q.priceHotel.$gte = minP;
      if (maxP) q.priceHotel.$lte = maxP;
    }

    // Phân trang
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    // Sắp xếp
    let sort = { createdAt: -1 };
    if (req.query.sort) {
      // ví dụ: sort=name:asc hoặc sort=priceHotel:desc
      const [field, dirRaw] = String(req.query.sort).split(":");
      const dir = (dirRaw || "asc").toLowerCase() === "desc" ? -1 : 1;
      if (field) sort = { [field]: dir };
    }

    // Query & count song song
    const [items, total] = await Promise.all([
      Hotel.find(q)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("company", "name")
        .populate("city", "name")
        // .populate("area", "name")
        .populate("hotelImages", "image_url")
        .lean(),
      Hotel.countDocuments(q),
    ]);

    res.json({
      data: items.map((h) => ({
        ...h,
        // Trả thêm numeric cho price nếu cần
        // priceHotelNumber: h.priceHotel ? parseFloat(h.priceHotel.toString()) : null,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      sort,
      filters: {
        q: req.query.q || null,
        company: q.company || null,
        city: q.city || null,
        area: q.area || null,
        minPrice: req.query.minPrice || null,
        maxPrice: req.query.maxPrice || null,
        includeDeleted,
      },
    });
  } catch (e) {
    next(e);
  }
};



export const publicList = async (req, res, next) => {
  try {
    // 🟢 LẤY THÊM type + amenities TỪ QUERY
    const { city, area, search, type, amenities } = req.query;

    // 1) Filter cơ bản theo vị trí + search
    const q = { isDelete: false }; // soft delete hotel

    if (city) q.city = city;
    if (area) q.area = area;

    // search theo tên + địa chỉ cho tiện
    if (search && search.trim()) {
      const rx = new RegExp(search.trim(), "i");
      q.$or = [{ name: rx }, { address: rx }];
    }

    // 🟢 FILTER LOẠI CHỖ Ở (HOTEL / APARTMENT / RESORT / ...)
    if (type) {
      q.type = type; // phải trùng enum trong HotelSchema
    }

    // 🟢 FILTER TIỆN NGHI (amenities=wifi,pool,breakfast)
    if (amenities) {
      const amenityList = amenities
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      if (amenityList.length > 0) {
        // yêu cầu KS phải có TẤT CẢ tiện nghi đã chọn
        q.amenities = { $all: amenityList };
      }
    }

    let hotels = await Hotel.find(q)
      .select(
        "name description address priceHotel discount city area hotelImages lat lng rating reviewCount tags type amenities"
      )
      .populate("city", "name")
      .populate("area", "name")
      .populate("hotelImages", "image_url")
      .lean();

    // 2) Convert Decimal128 -> number + chuẩn hoá rating/tags
    hotels = hotels.map((h) => ({
      ...h,
      priceHotel: parseFloat(h.priceHotel?.toString() || 0),
      rating: Number(h.rating || 0),
      reviewCount: Number(h.reviewCount || 0),
      tags: h.tags || [],
      amenities: h.amenities || [],
      type: h.type || "HOTEL",
    }));

    // 3) Đọc param ngày & số người
    const { check_in, check_out, adult_num, child_num, room_num } = req.query;

    //  Nếu KHÔNG có đủ check_in + check_out → trả luôn (KHÔNG 400)
    if (!check_in || !check_out) {
      return res.json({ data: hotels });
    }

    // 4) Parse ngày – nếu lỗi thì cũng trả luôn, không 400
    const parseDate = (s) => {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };

    const checkIn = parseDate(check_in);
    const checkOut = parseDate(check_out);

    if (!checkIn || !checkOut || checkIn >= checkOut) {
      // format không chuẩn / ngày sai → bỏ qua filter ngày
      return res.json({ data: hotels });
    }

    // 5) Tính số khách / phòng
    const adults = Number(adult_num || 1);
    const children = Number(child_num || 0);
    const roomsNeeded = Number(room_num || 1);
    const totalGuests = adults + children;
    const guestsPerRoom =
      roomsNeeded > 0 ? Math.ceil(totalGuests / roomsNeeded) : totalGuests;

    if (!hotels.length) {
      return res.json({ data: [] });
    }

    const hotelIds = hotels.map((h) => h._id);

    // 6) Lấy tất cả Room thuộc các hotel này, đủ max_guests
    const rooms = await Room.find({
      hotel: { $in: hotelIds },
      max_guests: { $gte: guestsPerRoom },
      // isDeleted đã được pre(/^find/) filter sẵn
    })
      .select("_id hotel")
      .lean();

    if (!rooms.length) {
      // không có phòng nào đủ sức chứa
      return res.json({ data: [] });
    }

    const roomIds = rooms.map((r) => r._id);

    // 7) Tìm booking overlap trong khoảng ngày đó
    const activeStatuses = [
      BOOKING_STATUS.PENDING,
      BOOKING_STATUS.PARTIAL,
      BOOKING_STATUS.PAID,
      BOOKING_STATUS.CHECKED_IN,
    ];

    const overlappedBookings = await Booking.find({
      status: { $in: activeStatuses },
      hotel: { $in: hotelIds },
      "rooms.room": { $in: roomIds },
      start_day: { $lt: checkOut },
      end_day: { $gt: checkIn },
    })
      .select("rooms.room")
      .lean();

    const bookedRoomIdSet = new Set();
    overlappedBookings.forEach((b) => {
      (b.rooms || []).forEach((it) => {
        if (it.room) bookedRoomIdSet.add(String(it.room));
      });
    });

    // 8) Đếm số room còn trống theo từng hotel
    const availableRoomCountByHotel = {}; // { hotelId: count }

    rooms.forEach((r) => {
      if (bookedRoomIdSet.has(String(r._id))) return; // phòng đã được đặt

      const hid = String(r.hotel);
      if (!availableRoomCountByHotel[hid]) {
        availableRoomCountByHotel[hid] = 0;
      }
      availableRoomCountByHotel[hid] += 1;
    });

    // 9) Chỉ giữ lại hotel có đủ roomsNeeded phòng trống
    const filteredByAvailability = hotels.filter((h) => {
      const count = availableRoomCountByHotel[String(h._id)] || 0;
      return count >= roomsNeeded;
    });

    return res.json({ data: filteredByAvailability });
  } catch (err) {
    next(err);
  }
};



// GET /api/hotels/public/:id/available-rooms
export const  publicAvailableRooms = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { check_in, check_out, adult_num, child_num, room_num } = req.query;

    console.log("Params:", req.params, req.query);

    // 1) Bắt buộc phải có ngày
    if (!check_in || !check_out) {
      return res
        .status(400)
        .json({ error: "check_in and check_out are required" });
    }

    const checkIn = new Date(check_in);
    const checkOut = new Date(check_out);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return res
        .status(400)
        .json({ error: "Invalid check_in or check_out date" });
    }
    if (checkIn >= checkOut) {
      return res
        .status(400)
        .json({ error: "check_out must be after check_in" });
    }

    // 2) Tính số khách / phòng
    const adults = Number(adult_num || 1);
    const children = Number(child_num || 0);
    const roomsNeeded = Number(room_num || 1);
    const totalGuests = adults + children;
    const guestsPerRoom =
      roomsNeeded > 0 ? Math.ceil(totalGuests / roomsNeeded) : totalGuests;

    // 3) Lấy tất cả Room thuộc hotel này, đủ max_guests
    const rooms = await Room.find({
      hotel: id,
      max_guests: { $gte: guestsPerRoom },
      // isDeleted đã được pre(/^find/) filter sẵn
    })
      .select("name description price basePrice max_guests beds size_sqm roomImages")
      .populate("roomImages", "image_url")
      .lean();

    if (!rooms.length) {
      return res.json({ data: [] });
    }

    const roomIds = rooms.map((r) => r._id);

    // 4) Tìm những Booking overlap trong khoảng ngày đó
    const activeStatuses = [
      BOOKING_STATUS.PENDING,
      BOOKING_STATUS.PARTIAL,
      BOOKING_STATUS.PAID,
      BOOKING_STATUS.CHECKED_IN,
    ];

    const overlappedBookings = await Booking.find({
      status: { $in: activeStatuses },
      hotel: id,
      "rooms.room": { $in: roomIds },
      start_day: { $lt: checkOut },
      end_day: { $gt: checkIn },
    })
      .select("rooms.room")
      .lean();

    const bookedRoomIdSet = new Set();
    overlappedBookings.forEach((b) => {
      (b.rooms || []).forEach((it) => {
        if (it.room) bookedRoomIdSet.add(String(it.room));
      });
    });

    // 5) Lọc ra danh sách phòng còn trống
    const availableRooms = rooms.filter(
      (r) => !bookedRoomIdSet.has(String(r._id))
    );

    return res.json({
      data: availableRooms,
      meta: {
        hotelId: id,
        check_in,
        check_out,
        adults,
        children,
        roomsNeeded,
        guestsPerRoom,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/hotels/:id
export const detail = async (req, res, next) => {
  try {
    const hotel = await Hotel.findById(req.params.id)
      .populate("company", "name")
      .populate("city", "name")
      .populate("hotelImages", "image_url")
      .populate({
        path: "room",
        populate: {
          path: "roomImages", // populate nested
          model: "RoomImage", // model tham chiếu
          select: "image_url",
        },
      })

      // .populate("area", "name")
      .lean();

    if (!hotel || hotel.isDelete) return res.status(404).json({ error: "Hotel not found" });

    // Quyền: ADMIN xem được; ADMINHOTEL phải cùng company (enforce ở middleware route)
    res.json(hotel);
  } catch (e) { next(e); }
};


// GET /api/hotels/public/:id
export const publicDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const h = await Hotel.findOne({
      _id: id,
      isDelete: false,
    })
      .select(
        "name description address priceHotel discount city area hotelImages lat lng rating reviewCount tags checkInTime checkOutTime"
      )
      .populate("city", "name")
      .populate("area", "name")
      .populate("hotelImages", "image_url")
      .lean();

    if (!h) {
      return res.status(404).json({ error: "Hotel not found" });
    }

    const hotel = {
      ...h,
      priceHotel: parseFloat(h.priceHotel?.toString() || 0),
      rating: Number(h.rating || 0),
      reviewCount: Number(h.reviewCount || 0),
      tags: h.tags || [],
    };

    return res.json(hotel);
  } catch (err) {
    next(err);
  }
};






// POST /api/hotels
// export const create = async (req, res, next) => {
//   try {


//     // 1) Quyền
//     const roles = (req.user?.roles || []).map((r) => String(r).toUpperCase());
//     const isAdmin = roles.includes(ROLE.ADMIN);
//     const isAdminHotel = roles.includes(ROLE.ADMIN_HOTEL);
//     if (!isAdmin && !isAdminHotel) {
//       return res.status(403).json({ error: "Forbidden" });
//     }

//     console.log(req.body.meta)

//     // 2) Lấy payload từ JSON hoặc form-data(meta hoặc phẳng)
//     let body;
//     if (typeof req.body.meta === "string" && req.body.meta.trim().startsWith("{")) {
//       try { body = JSON.parse(req.body.meta); }
//       catch { return res.status(400).json({ error: "Invalid meta JSON" }); }
//     } else {
//       body = { ...req.body };
//     }



//     // 3) Chuẩn hoá field + ép kiểu
//     const toNum = (v, d = undefined) => (v === "" || v == null ? d : Number(v));
//     const norm = {
//       name: body.name,
//       description: body.description ?? "",
//       address: body.address ?? "",

//       priceHotel: toNum(body.priceHotel ?? body.price),
//       discount: toNum(body.discount, 0),

//       lat: toNum(body.lat),
//       lng: toNum(body.lng),

//       checkInTime: body.checkInTime ?? body.check_in_time,
//       checkOutTime: body.checkOutTime ?? body.check_out_time,

//       city: body.city ?? body.city_id,
//       area: body.area ?? body.area_id,
//       company: body.company, // sẽ ép lại nếu ADMINHOTEL
//     };

//     if (isAdminHotel) {
//       if (!req.user.company) {
//         return res.status(400).json({ error: "Your account has no company assigned" });
//       }
//       norm.company = String(req.user.company);
//     }

//     // 4) Validate
//     const { value, error } = createHotelSchema.validate(norm, { abortEarly: false });
//     if (error) return res.status(400).json({ error: error.message });

//     // 5) Lưu Hotel
//     const hotel = new Hotel({
//       name: value.name,
//       description: value.description,
//       address: value.address,
//       priceHotel: toDecimal128(value.priceHotel),
//       discount: value.discount ?? 0,
//       lat: value.lat,
//       lng: value.lng,
//       checkInTime: value.checkInTime || undefined,
//       checkOutTime: value.checkOutTime || undefined,
//       city: value.city || undefined,
//       area: value.area || undefined,
//       company: value.company || undefined,
//     });

//     const savedHotel = await hotel.save();

//     // 6) Nếu có ảnh: tạo HotelImage & gắn vào hotel
//     const createdImages = [];
//     if (Array.isArray(req.files) && req.files.length > 0) {
//       for (const f of req.files) {
//         const url = `/uploads/hotels/${f.filename}`; // đường dẫn public
//         const img = await HotelImage.create({
//           image_url: url,
//           hotel: savedHotel._id,
//         });
//         createdImages.push(img._id);
//       }

//       if (createdImages.length) {
//         savedHotel.hotelImages.push(...createdImages);
//         await savedHotel.save();
//       }
//     }

//     // 7) Trả về Hotel đã populate
//     const out = await Hotel.findById(savedHotel._id)
//       .populate("company", "name")
//       // .populate("city", "name")
//       // .populate("area", "name")
//       .populate("hotelImages", "image_url")
//       .lean();

//     res.status(201).json(out);
//   } catch (e) {
//     next(e);
//   }
// };
export const create = async (req, res, next) => {
  try {
    // 1) Quyền
    const roles = (req.user?.roles || []).map((r) => String(r).toUpperCase());
    const isAdmin = roles.includes(ROLE.ADMIN);
    const isAdminHotel = roles.includes(ROLE.ADMIN_HOTEL);
    if (!isAdmin && !isAdminHotel) {
      return res.status(403).json({ error: "Forbidden" });
    }

    console.log(req.body.meta);

    // 2) Lấy payload từ JSON hoặc form-data(meta hoặc phẳng)
    let body;
    if (
      typeof req.body.meta === "string" &&
      req.body.meta.trim().startsWith("{")
    ) {
      try {
        body = JSON.parse(req.body.meta);
      } catch {
        return res.status(400).json({ error: "Invalid meta JSON" });
      }
    } else {
      body = { ...req.body };
    }

    // Chuẩn hoá tags:
    // - Nếu là array: dùng luôn
    // - Nếu là string: "a,b,c" -> ["a","b","c"]
    let tags = [];
    if (Array.isArray(body.tags)) {
      tags = body.tags.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof body.tags === "string") {
      tags = body.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    // 3) Chuẩn hoá field + ép kiểu
    const toNum = (v, d = undefined) =>
      v === "" || v == null ? d : Number(v);

    const norm = {
      name: body.name,
      description: body.description ?? "",
      address: body.address ?? "",

      priceHotel: toNum(body.priceHotel ?? body.price),
      discount: toNum(body.discount, 0),

      lat: toNum(body.lat),
      lng: toNum(body.lng),

      checkInTime: body.checkInTime ?? body.check_in_time,
      checkOutTime: body.checkOutTime ?? body.check_out_time,

      city: body.city ?? body.city_id,
      area: body.area ?? body.area_id,
      company: body.company, // sẽ ép lại nếu ADMINHOTEL

      // ⭐ THÊM 3 FIELD MỚI
      rating: toNum(body.rating, 0),          // vd: 4.5
      reviewCount: toNum(body.reviewCount, 0),// vd: 320
      tags,                                   // ["Miễn phí huỷ","Bao gồm ăn sáng"]
    };

    if (isAdminHotel) {
      if (!req.user.company) {
        return res
          .status(400)
          .json({ error: "Your account has no company assigned" });
      }
      norm.company = String(req.user.company);
    }

    // 4) Validate
    const { value, error } = createHotelSchema.validate(norm, {
      abortEarly: false,
    });
    if (error) return res.status(400).json({ error: error.message });

    // 5) Lưu Hotel
    const hotel = new Hotel({
      name: value.name,
      description: value.description,
      address: value.address,
      priceHotel: toDecimal128(value.priceHotel),
      discount: value.discount ?? 0,
      lat: value.lat,
      lng: value.lng,
      checkInTime: value.checkInTime || undefined,
      checkOutTime: value.checkOutTime || undefined,
      city: value.city || undefined,
      area: value.area || undefined,
      company: value.company || undefined,

      // ⭐ lưu thêm
      rating: value.rating ?? 0,
      reviewCount: value.reviewCount ?? 0,
      tags: value.tags || [],
    });
    console.log("hotel:", hotel);

    const savedHotel = await hotel.save();

    // 6) Nếu có ảnh: tạo HotelImage & gắn vào hotel
    const createdImages = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      for (const f of req.files) {
        const url = `/uploads/hotels/${f.filename}`;
        const img = await HotelImage.create({
          image_url: url,
          hotel: savedHotel._id,
        });
        createdImages.push(img._id);
      }

      if (createdImages.length) {
        savedHotel.hotelImages.push(...createdImages);
        await savedHotel.save();
      }
    }

    // 7) Trả về Hotel đã populate
    const out = await Hotel.findById(savedHotel._id)
      .populate("company", "name")
      // .populate("city", "name")
      // .populate("area", "name")
      .populate("hotelImages", "image_url")
      .lean();

    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
};

// PUT/PATCH /api/hotels/:id
export const update = async (req, res, next) => {
  try {
    //  BỎ validate Joi – dùng trực tiếp req.body
    const value = req.body || {};
    console.log("Update hotel payload:", value);

    const hotel = await Hotel.findById(req.params.id);
    if (!hotel || hotel.isDelete) {
      return res.status(404).json({ error: "Hotel not found" });
    }

    // ====== CẬP NHẬT CÁC FIELD SIMPLE ======
    if (value.name != null) hotel.name = value.name;
    if (value.description !== undefined) hotel.description = value.description;
    if (value.address !== undefined) hotel.address = value.address;

    // priceHotel: convert sang number rồi Decimal128
    if (value.priceHotel !== undefined) {
      const priceNum = Number(value.priceHotel);
      if (Number.isFinite(priceNum)) {
        hotel.priceHotel = toDecimal128(priceNum);
      }
    }

    if (value.discount !== undefined) {
      hotel.discount = Number(value.discount);
    }

    // type & amenities (nếu bạn đang dùng)
    if (value.type !== undefined) {
      hotel.type = value.type;
    }
    if (value.amenities !== undefined) {
      hotel.amenities = Array.isArray(value.amenities)
        ? value.amenities
        : [];
    }

    // ====== VỊ TRÍ ======
    if (value.location) {
      // nếu client gửi hẳn location { type, coordinates }
      hotel.location = value.location;
      hotel.lat = undefined;
      hotel.lng = undefined;
    } else {
      // chỉ sửa lat/lng nếu client gửi
      if (value.lat != null) hotel.lat = Number(value.lat);
      if (value.lng != null) hotel.lng = Number(value.lng);

      // nếu đủ lat + lng thì sync sang location
      if (hotel.lat != null && hotel.lng != null) {
        hotel.setLatLng(hotel.lat, hotel.lng);
      }
    }

    // ====== GIỜ NHẬN/TRẢ PHÒNG ======
    if (value.checkInTime !== undefined) {
      hotel.checkInTime = value.checkInTime || undefined;
    }
    if (value.checkOutTime !== undefined) {
      hotel.checkOutTime = value.checkOutTime || undefined;
    }

    // ====== CITY / AREA ======
    if (value.city !== undefined) {
      hotel.city = value.city || undefined;
    }
    if (value.area !== undefined) {
      hotel.area = value.area || undefined;
    }


    await hotel.save();

    const out = await Hotel.findById(hotel._id)
      .populate("company", "name")
      .populate("hotelImages", "image_url") // ✅ populate ảnh cho response
      .lean();

    return res.json({ message: "Hotel updated", hotel: out });
  } catch (e) {
    console.log("Update hotel error:", e);
    next(e);
  }
};



// DELETE /api/hotels/:id  (soft delete; hard delete qua ?force=1)
export const remove = async (req, res, next) => {
  try {
    const force = req.query.force === "1";

    if (force) {
      const del = await Hotel.findByIdAndDelete(req.params.id);
      if (!del) return res.status(404).json({ error: "Hotel not found" });
      return res.json({ message: "Hotel permanently deleted", id: del._id });
    }

    const hotel = await Hotel.findById(req.params.id);
    if (!hotel || hotel.isDelete) return res.status(404).json({ error: "Hotel not found" });

    hotel.isDelete = true;
    await hotel.save();
    res.json({ message: "Hotel soft-deleted", id: hotel._id });
  } catch (e) { next(e); }
};

// PATCH /api/hotels/:id/restore
export const restore = async (req, res, next) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel || !hotel.isDelete) return res.status(404).json({ error: "Hotel not found or not deleted" });
    hotel.isDelete = false;
    await hotel.save();
    res.json({ message: "Hotel restored", id: hotel._id });
  } catch (e) { next(e); }
};



const rolesOf = (req) => (req.user?.roles || []).map(r => String(r).toUpperCase());
const isStaff = (req) => rolesOf(req).includes(ROLE.STAFF);
const isAdminHotel = (req) => rolesOf(req).includes(ROLE.ADMIN_HOTEL) || rolesOf(req).includes(ROLE.ADMINHOTEL);
const isAdmin = (req) => rolesOf(req).includes(ROLE.ADMIN);

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


// GET /api/hotels/:id/rooms
export const listRoomsOfHotel = async (req, res, next) => {
  try {
    const hotelId = req.params.id;

    // kiểm tra quyền
    await assertHotelPermission(req, hotelId);

    // lấy phòng (lọc không lấy phòng đã xóa nếu bạn dùng isDeleted/deleteRoom)
    const rooms = await Room.find({
      hotel: hotelId,
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        { deleteRoom: { $exists: false } },
        { deleteRoom: false },
      ],
    })
      .select("_id name number typeName category beds price basePrice max_guests status")
      .sort({ name: 1 })
      .lean();

    res.json(rooms);
  } catch (e) {
    if (e.message.startsWith("Forbidden")) {
      return res.status(403).json({ error: e.message });
    }
    next(e);
  }
};


// POST /api/hotels/:hotelId/images
export const uploadHotelImageController = async (req, res, next) => {
  try {
    const { hotelId } = req.params;

    if (!hotelId) {
      return res.status(400).json({ error: "Missing hotelId" });
    }

    // vì route dùng uploadHotelImages.array("images", 10)
    // => multer gán file vào req.files (mảng)
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const hotel = await Hotel.findById(hotelId);
    if (!hotel || hotel.isDelete) {
      return res.status(404).json({ error: "Hotel not found" });
    }

    // Tạo nhiều HotelImage tương ứng từng file
    const docsToCreate = req.files.map((f) => ({
      image_url: `/uploads/hotels/${f.filename}`,
      hotel: hotel._id,
    }));

    const imgDocs = await HotelImage.insertMany(docsToCreate);

    // hotel.hotelImages là mảng ObjectId -> chỉ push _id
    hotel.hotelImages = hotel.hotelImages || [];
    hotel.hotelImages.push(...imgDocs.map((d) => d._id));
    await hotel.save();

    // Populate lại hotel để trả cho FE
    const out = await Hotel.findById(hotel._id)
      .populate("company", "name")
      .populate("hotelImages", "image_url")
      .lean();

    return res.json({
      message: "Upload ảnh khách sạn thành công",
      images: imgDocs, // danh sách ảnh mới tạo
      hotel: out,
    });
  } catch (e) {
    console.error("Upload hotel image error:", e);
    next(e);
  }
};



// DELETE /api/hotels/:hotelId/images/:imageId
export const deleteHotelImageController = async (req, res, next) => {
  try {
    const { hotelId, imageId } = req.params;

    if (!hotelId || !imageId) {
      return res
        .status(400)
        .json({ error: "Missing hotelId or imageId" });
    }

    // Tìm hotel
    const hotel = await Hotel.findById(hotelId);
    if (!hotel || hotel.isDelete) {
      return res.status(404).json({ error: "Hotel not found" });
    }

    // Tìm ảnh trong collection HotelImage
    const imgDoc = await HotelImage.findById(imageId);
    if (!imgDoc) {
      return res.status(404).json({ error: "Hotel image not found" });
    }

    // Đảm bảo ảnh thuộc đúng hotel
    if (String(imgDoc.hotel) !== String(hotel._id)) {
      return res
        .status(400)
        .json({ error: "Image does not belong to this hotel" });
    }

    // Xoá file vật lý
    const filePath = "." + imgDoc.image_url; // vì image_url lưu dạng /uploads/...
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Cannot delete image file:", err);
      // không fail request chỉ vì lỗi xoá file
    }

    // Xoá document HotelImage
    await HotelImage.deleteOne({ _id: imageId });

    // Loại imageId khỏi mảng hotel.hotelImages (mảng ObjectId)
    hotel.hotelImages = (hotel.hotelImages || []).filter(
      (id) => String(id) !== String(imageId)
    );
    await hotel.save();

    // Trả về hotel đã populate lại ảnh
    const out = await Hotel.findById(hotel._id)
      .populate("company", "name")
      .populate("hotelImages", "image_url")
      .lean();

    return res.json({
      message: "Xoá ảnh thành công",
      hotel: out,
    });
  } catch (e) {
    console.error("Delete hotel image error:", e);
    next(e);
  }
};

