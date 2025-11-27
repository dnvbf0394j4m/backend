import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true, // mỗi booking chỉ đánh giá 1 lần
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ⭐ điểm đánh giá
    rating: { type: Number, min: 1, max: 5, required: true },

    // nội dung đánh giá
    comment: { type: String, default: "" },
     isVerifiedStay: { type: Boolean, default: true },

    // danh sách ảnh (URL)
    images: [{ type: String }],

    // Chủ khách sạn trả lời
    reply: {
      text: { type: String },
      repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      repliedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Review", reviewSchema);
