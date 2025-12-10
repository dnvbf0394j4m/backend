import mongoose from "mongoose";
import Review from "../models/Review.js";
import { Booking, BOOKING_STATUS } from "../models/Booking.js";
import { Hotel } from "../models/Hotel.js";

// Helper: tính lại averageRating + reviewCount cho hotel
async function recalcHotelRating(hotelId) {
  const objId = new mongoose.Types.ObjectId(hotelId);

  const stats = await Review.aggregate([
    { $match: { hotel: objId } },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
  ]);

  if (!stats.length) {
    await Hotel.findByIdAndUpdate(hotelId, {
      rating: 0,
      reviewCount: 0,
    });
    return;
  }

  let total = 0;
  let totalCount = 0;
  stats.forEach((s) => {
    total += s._id * s.count;
    totalCount += s.count;
  });

  const avg = total / totalCount;

  await Hotel.findByIdAndUpdate(hotelId, {
    rating: avg,
    reviewCount: totalCount,
  });
}

// POST /api/reviews
export const createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    const booking = await Booking.findById(bookingId).populate("hotel user");
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check booking thuộc user hiện tại
    if (String(booking.user._id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Bạn không được phép đánh giá booking này" });
    }

    // Check đã checkout chưa
    if (booking.status !== BOOKING_STATUS.CHECKED_OUT) {
      return res
        .status(400)
        .json({ error: "Chỉ được đánh giá sau khi đã trả phòng" });
    }

    // Check đã đánh giá booking này chưa

    const existed = await Review.findOne({ booking: booking._id });
    if (existed) {
      return res.status(400).json({ error: "Booking này đã được đánh giá" });
    }

    const review = await Review.create({
      booking: booking._id,
      hotel: booking.hotel._id,
      user: booking.user._id,
      rating,
      comment: comment || "",
      // images: Array.isArray(images) ? images : [],
    });

    // Tính lại rating cho Hotel
    await recalcHotelRating(booking.hotel._id);

    booking.reviewed = true;
    await booking.save();


    res.status(201).json(review);
  } catch (err) {
    console.error("createReview error:", err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/reviews/hotel/:hotelId?limit=&page=
export const listReviewsByHotel = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const query = { hotel: hotelId };

    const [items, total] = await Promise.all([
      Review.find(query)
        .populate("user", "name avatar email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Review.countDocuments(query),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("listReviewsByHotel error:", err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/reviews/hotel/:hotelId/stats
// -> trả về averageRating, reviewCount, histogram 1-5 sao
export const getReviewStats = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const objId = new mongoose.Types.ObjectId(hotelId);

    const stats = await Review.aggregate([
      { $match: { hotel: objId } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
    ]);

    let total = 0;
    let totalCount = 0;
    const histogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    stats.forEach((s) => {
      histogram[s._id] = s.count;
      total += s._id * s.count;
      totalCount += s.count;
    });

    const avg = totalCount ? total / totalCount : 0;

    res.json({
      rating: avg,
      reviewCount: totalCount,
      histogram,
    });
  } catch (err) {
    console.error("getReviewStats error:", err);
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/reviews/:id/reply
// Chủ khách sạn / ADMIN_HOTEL trả lời
export const replyReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    // Ở đây giả sử req.user.role có ADMIN_HOTEL hoặc ADMIN
    if (!["ADMIN_HOTEL", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "Không có quyền trả lời review" });
    }

    const review = await Review.findById(id).populate("hotel");
    if (!review) {
      return res.status(404).json({ error: "Review không tồn tại" });
    }

    // Nếu là ADMIN_HOTEL thì phải đúng khách sạn mà họ quản lý
    if (req.user.role === "ADMIN_HOTEL") {
      // giả sử user có field managedHotel
      if (String(req.user.managedHotel) !== String(review.hotel._id)) {
        return res.status(403).json({ error: "Không được trả lời review khách sạn khác" });
      }
    }

    review.reply = {
      text,
      repliedBy: req.user._id,
      repliedAt: new Date(),
    };

    await review.save();

    res.json(review);
  } catch (err) {
    console.error("replyReview error:", err);
    res.status(500).json({ error: err.message });
  }
};


