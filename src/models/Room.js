import mongoose from "mongoose";
const { Schema } = mongoose;

export const ROOM_STATUS = {
  AVAILABLE: "AVAILABLE",        // trống
  OCCUPIED: "OCCUPIED",          // đang có khách
  MAINTENANCE: "MAINTENANCE",    // bảo trì
  CLEANING: "CLEANING",          // đang dọn
  OUT_OF_SERVICE: "OUT_OF_SERVICE"
};

const RoomSchema = new Schema(
  {
    // _id thay cho room_id (Long)
    name:        { type: String, required: true, trim: true },
    description: { type: String, trim: true },       // sửa từ desctiption
    // Giá: nên dùng Number (VND) để đơn giản; nếu cần số lớn/decimal có thể chuyển Decimal128
    price:       { type: Number, min: 0, required: true },  // tương ứng @Column(precision=10,scale=2)
    basePrice:   { type: Number, min: 0 },                  // nếu dùng giá gốc
    max_guests:  { type: Number, min: 1, default: 1 },
    beds:        { type: String, trim: true },              // vd: "1 Queen", "2 Twin"
    size_sqm:    { type: Number, min: 0 },                  // m² (JPA BigDecimal)

    status: {
      type: String,
      enum: Object.values(ROOM_STATUS),
      default: ROOM_STATUS.AVAILABLE,
      index: true
    },

    // Soft delete thay cho deleteRoom
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },

    // ManyToOne: Room -> Hotel
    hotel: { type: Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },

    // OneToMany: Room -> RoomImage (populate khi cần)
    roomImages: [{ type: Schema.Types.ObjectId, ref: "RoomImage" }],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual: các booking có chứa phòng này (nếu bạn dùng items.rooms trong Booking)
RoomSchema.virtual("bookings", {
  ref: "Booking",
  localField: "_id",
  foreignField: "items.rooms"
});

// Index gợi ý: tìm phòng theo khách sạn và tên
RoomSchema.index({ hotel: 1, name: 1 }, { unique: false });

// ----- SOFT-DELETE MIDDLEWARE -----
// Tự động ẩn isDeleted=true trong mọi truy vấn find/findOne/...
RoomSchema.pre(/^find/, function(next) {
  if (!this.options?.includeDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

// Helpers để lấy cả bản ghi đã xóa
RoomSchema.statics.findWithDeleted = function (filter = {}) {
  return this.find(filter).setOptions({ includeDeleted: true });
};
RoomSchema.statics.findOneWithDeleted = function (filter = {}) {
  return this.findOne(filter).setOptions({ includeDeleted: true });
};
RoomSchema.statics.findByIdWithDeleted = function (id) {
  return this.findById(id).setOptions({ includeDeleted: true });
};

export const Room = mongoose.model("Room", RoomSchema);
