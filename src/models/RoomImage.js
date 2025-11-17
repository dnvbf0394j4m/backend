import mongoose from "mongoose";
const { Schema } = mongoose;

const RoomImageSchema = new Schema(
  {
    image_url: { type: String, required: true, trim: true },
    room:      { type: Schema.Types.ObjectId, ref: "Room", required: true },
  },
  { timestamps: true }
);

RoomImageSchema.index({ room: 1 });

export const RoomImage = mongoose.model("RoomImage", RoomImageSchema);
