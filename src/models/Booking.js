import mongoose from "mongoose";
const { Schema } = mongoose;

export const BOOKING_STATUS = {
  PENDING: "PENDING",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  CHECKED_IN: "CHECKED_IN",
  CHECKED_OUT: "CHECKED_OUT",
  CANCELLED: "CANCELLED",
};

const PaymentSchema = new Schema(
  {
    method: { 
      type: String, 
      enum: ["OFFLINE_CASH", "OFFLINE_CARD", "VNPAY"], 
      required: true 
    },
    amount: { type: Number, min: 0, required: true },
    note:   { type: String, trim: true },
    by:     { type: Schema.Types.ObjectId, ref: "User" }, // online user có thể để null
    at:     { type: Date, default: Date.now },
  },
  { _id: false }
);


const BookingSchema = new Schema(
  {
    orderCode: { type: String, unique: true, index: true },

    hotel:   { type: Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", index: true },

    // khách vãng lai (tại quầy)
    customer: {
      name:  { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, trim: true, lowercase: true },
      idNumber: { type: String, trim: true },
    },

    // Mỗi phần tử là 1 phòng đã chọn + đơn giá áp dụng
    rooms: [
      {
        room:  { type: Schema.Types.ObjectId, ref: "Room", required: true },
        price: { type: Number, min: 0, required: true },
      },
    ],

    start_day: { type: Date, required: true, index: true },
    end_day:   { type: Date, required: true, index: true },

    amount: { type: Number, min: 0, required: true },  // tổng tiền (đã tính số đêm x phòng)
    paid:   { type: Number, min: 0, default: 0 },
    status: { type: String, enum: Object.values(BOOKING_STATUS), default: BOOKING_STATUS.PENDING, index: true },

    payments:  { type: [PaymentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    note:      { type: String, trim: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Sinh mã đơn đơn giản
BookingSchema.pre("save", function(next) {
  if (!this.orderCode) {
    const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
    this.orderCode = `BK-${Date.now().toString().slice(-6)}-${rnd}`;
  }
  next();
});



// index phục vụ tra cứu
BookingSchema.index({ hotel: 1, "rooms.room": 1, start_day: 1, end_day: 1 });


// src/models/Booking.js (bổ sung dưới cùng file sau khi define BookingSchema)

BookingSchema.pre(/^find/, function (next) {
  // Ẩn mặc định các booking đã xóa mềm
  if (!this.options?.includeDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

// Helpers truy vấn kèm cả đã xóa
BookingSchema.statics.findWithDeleted = function (filter = {}) {
  return this.find(filter).setOptions({ includeDeleted: true });
};
BookingSchema.statics.findOneWithDeleted = function (filter = {}) {
  return this.findOne(filter).setOptions({ includeDeleted: true });
};
BookingSchema.statics.findByIdWithDeleted = function (id) {
  return this.findById(id).setOptions({ includeDeleted: true });
};

export const Booking = mongoose.model("Booking", BookingSchema);


