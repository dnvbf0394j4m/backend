// src/models/Hotel.js
import mongoose from "mongoose";

const { Schema } = mongoose;

// Dùng Decimal128 cho tiền tệ để tránh sai số số thực
const Money = Schema.Types.Decimal128;

// Lưu giờ dưới dạng "HH:mm" (đơn giản, dễ validate)
const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const HotelSchema = new Schema(
  {
    // _id thay cho hotelId tự tăng
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    address: { type: String, trim: true },

    // 🟢 LOẠI CHỖ Ở: HOTEL / APARTMENT / RESORT / ...
    type: {
      type: String,
      enum: ["HOTEL", "APARTMENT", "RESORT", "HOMESTAY", "VILLA"],
      default: "HOTEL",
      index: true,
    },

    // priceHotel: DECIMAL(10,2)
    priceHotel: { type: Money, required: true }, // lưu Decimal128
    discount: { type: Number, min: 0, max: 100, default: 0 },

    isDelete: { type: Boolean, default: false }, // soft-delete

    // Vị trí: khuyến nghị dùng GeoJSON + 2dsphere index
    // location: {
    //   type: { type: String, enum: ["Point"], default: "Point" },
    //   coordinates: { type: [Number], required: true }, // [lng, lat]
    // },

    // Nếu muốn giữ lat/lng riêng như JPA (tùy): có thể bỏ nếu dùng location
    lat: { type: Number }, // optional: đồng bộ từ location
    lng: { type: Number },

    checkInTime: { type: String, validate: (v) => !v || timeRegex.test(v) },
    checkOutTime: { type: String, validate: (v) => !v || timeRegex.test(v) },

    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0, // nếu chưa có review thì 0
    },

    reviewCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    tags: {
      type: [String],
      default: [], // ví dụ: ['Miễn phí huỷ', 'Bao gồm ăn sáng']
    },

    // 🟢 TIỆN NGHI – dùng chung với filter frontend
    // ví dụ: ["wifi", "pool", "breakfast"]
    amenities: {
      type: [String],
      default: [],
      index: true,
    },

    // ManyToOne
    city: { type: Schema.Types.ObjectId, ref: "City" },
    area: { type: Schema.Types.ObjectId, ref: "Area" },
    company: { type: Schema.Types.ObjectId, ref: "Company" },

    // OneToMany
    hotelImages: [{ type: Schema.Types.ObjectId, ref: "HotelImage" }],
    room: [{ type: Schema.Types.ObjectId, ref: "Room" }],
    employees: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

// Index
HotelSchema.index({ name: 1 });
HotelSchema.index({ company: 1, name: 1 });
HotelSchema.index({ location: "2dsphere" }); // để query gần/địa lý
HotelSchema.index({ type: 1 });
HotelSchema.index({ amenities: 1 });

HotelSchema.virtual("rooms", {
  ref: "Room",
  localField: "_id",
  foreignField: "hotel",
});
HotelSchema.set("toObject", { virtuals: true });
HotelSchema.set("toJSON", { virtuals: true });

// Helper: set lat/lng nhanh, tự sync vào GeoJSON
HotelSchema.methods.setLatLng = function (lat, lng) {
  this.lat = lat;
  this.lng = lng;
  this.location = { type: "Point", coordinates: [lng, lat] };
};

// Getter tiện: trả priceHotel dạng number (chỉ dùng để đọc)
HotelSchema.virtual("priceHotelNumber").get(function () {
  return this.priceHotel ? parseFloat(this.priceHotel.toString()) : null;
});

export const Hotel = mongoose.model("Hotel", HotelSchema);
