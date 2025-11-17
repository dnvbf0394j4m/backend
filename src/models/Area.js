// src/models/Area.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const AreaSchema = new Schema(
  {
    // _id (ObjectId) sẽ thay cho areaId auto-increment
    name: { type: String, required: true, trim: true },

    // GeoJSON Point (ưu tiên dùng để query địa lý)
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },

    // Nếu muốn lưu tách lat/lng như JPA (tuỳ chọn)
    lat: { type: Number },
    lng: { type: Number },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual One-to-Many: Area -> Hotels (Hotel.area)
AreaSchema.virtual("hotels", {
  ref: "Hotel",
  localField: "_id",
  foreignField: "area",
});

// Index
AreaSchema.index({ name: 1 });
AreaSchema.index({ location: "2dsphere" });

// Helper: set lat/lng & đồng bộ sang GeoJSON
AreaSchema.methods.setLatLng = function (lat, lng) {
  this.lat = Number(lat);
  this.lng = Number(lng);
  this.location = { type: "Point", coordinates: [Number(lng), Number(lat)] };
};

export const Area = mongoose.model("Area", AreaSchema);
