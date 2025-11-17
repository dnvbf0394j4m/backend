// src/models/HotelImage.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const HotelImageSchema = new Schema(
  {
    // _id tự sinh của MongoDB thay cho image_id
    image_url: { type: String, required: true, trim: true },

    // Quan hệ ManyToOne -> Hotel
    hotel: {
      type: Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
  },
  {
    timestamps: true, // thêm createdAt, updatedAt
  }
);

// Index: tối ưu truy vấn theo hotel
HotelImageSchema.index({ hotel: 1 });

export const HotelImage = mongoose.model("HotelImage", HotelImageSchema);
