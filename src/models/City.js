import mongoose from "mongoose";
const { Schema } = mongoose;

const CitySchema = new Schema(
  {
    // _id của Mongo thay cho city_id (int)
    name:    { type: String, required: true, trim: true },
    country: { type: String, trim: true },

    // Chỉ dùng lat/lng dạng số (theo lựa chọn của bạn, KHÔNG dùng GeoJSON)
    lat: { type: Number, required: true, min: -90,  max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },

    url_img: { type: String, trim: true }, // link ảnh city (nếu có)
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual One-to-Many: City -> Hotels (Hotel.city)
CitySchema.virtual("hotels", {
  ref: "Hotel",
  localField: "_id",
  foreignField: "city",
});

// Index gợi ý
CitySchema.index({ name: 1, country: 1 });

export const City = mongoose.model("City", CitySchema);
