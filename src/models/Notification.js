import mongoose from "mongoose";
const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true }, // người nhận
    hotel: { type: Schema.Types.ObjectId, ref: "Hotel", required: true },
    type: { type: String, enum: ["NEW_BOOKING"], required: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking" },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", NotificationSchema);
