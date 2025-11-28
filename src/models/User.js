import mongoose from "mongoose";
import bcrypt from "bcrypt";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, index: true, unique: true, sparse: true },
    password_hash: { type: String, required: true },
    phone: { type: String, trim: true, index: true, sparse: true },
    create_at: { type: Date, default: Date.now },
    firstLogin: { type: Boolean, default: true },
    roles: [{ type: String, index: true }],   // dùng String cho khớp Role._id
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" }, // optional nếu có Company model sau
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel" },     // optional nếu có Hotel model sau
    // 🔽 Soft delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    refreshTokens: [{
      token: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    }],
     tokenVersion: { type: Number, default: 0 },

  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

UserSchema.virtual("bookings", {
  ref: "Booking",
  localField: "_id",
  foreignField: "user"
});

UserSchema.index({ hotel: 1, name: 1 });
UserSchema.index({ company: 1, name: 1 });

// ----- SOFT-DELETE MIDDLEWARE -----
// Tự động thêm { isDeleted: false } vào mọi find()/findOne()/findById()…
// Có thể bỏ qua bằng cách setOptions({ includeDeleted: true })
UserSchema.pre(/^find/, function (next) {
  if (!this.options?.includeDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

// Helper: lấy cả bản ghi đã xóa (bỏ filter mặc định)
UserSchema.statics.findWithDeleted = function (filter = {}) {
  return this.find(filter).setOptions({ includeDeleted: true });
};
UserSchema.statics.findOneWithDeleted = function (filter = {}) {
  return this.findOne(filter).setOptions({ includeDeleted: true });
};
UserSchema.statics.findByIdWithDeleted = function (id) {
  return this.findById(id).setOptions({ includeDeleted: true });
};

UserSchema.methods.setPassword = async function (plain) {
  const salt = await bcrypt.genSalt(10);
  this.password_hash = await bcrypt.hash(plain, salt);
};
UserSchema.methods.verifyPassword = async function (plain) {
  return bcrypt.compare(plain, this.password_hash);
};

export const User = mongoose.model("User", UserSchema);
