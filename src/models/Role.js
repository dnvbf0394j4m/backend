import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, trim: true }, // ADMIN, STAFF, USER
    description: { type: String, trim: true }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

RoleSchema.virtual("users", {
  ref: "User",
  localField: "_id",
  foreignField: "roles"
});

export const Role = mongoose.model("Role", RoleSchema);
