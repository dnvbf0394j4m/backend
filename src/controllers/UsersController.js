

import { User } from "../models/User.js";
import { createUserSchema, updateUserSchema } from "../validations/user.validation.js";

// GET /api/users   (mặc định ẩn user đã xoá nhờ middleware)
export const list = async (req, res, next) => {
  try {
    const q = User.find();
    // Nếu admin muốn xem cả đã xoá: /api/users?includeDeleted=1
    if (req.query.includeDeleted === "1") {
      const roles = (req.user?.roles || []).map(r => r.name || r);
      if (!(roles.includes("ADMIN") || roles.includes("ADMINHOTEL"))) {
        return res.status(403).json({ error: "You are not allowed to view deleted users" });
      }
      q.setOptions({ includeDeleted: true });
    }

    const users = await q
      .select("-password_hash")
      .populate("company", "name")
      .populate("hotel", "name")
      .lean();

    res.json(users);
  } catch (e) { next(e); }
};

// GET /api/users/:id   (ẩn user đã xoá; thêm ?includeDeleted=1 cho admin)
export const detail = async (req, res, next) => {
  try {
    const q = User.findById(req.params.id);
    if (req.query.includeDeleted === "1") {
      const roles = (req.user?.roles || []).map(r => r.name || r);
      if (!(roles.includes("ADMIN") || roles.includes("ADMINHOTEL"))) {
        return res.status(403).json({ error: "You are not allowed to view deleted users" });
      }
      q.setOptions({ includeDeleted: true });
    }

    const user = await q
      .select("-password_hash")
      .populate("company", "name")
      .populate("hotel", "name")
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (e) { next(e); }
};

// POST /api/users   (mặc định roles=["USER"])
export const create = async (req, res, next) => {
  try {
    const { value, error } = createUserSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const { name, email, password, phone, company, hotel, roles } = value;
    const dup = await User.findOne({ email });
    if (dup) return res.status(400).json({ error: "Email already exists" });

    const user = new User({
      name, email, phone,
      company: company || undefined,
      hotel:   hotel   || undefined,
      roles: roles?.length ? roles : ["USER"],
    });

    await user.setPassword(password || "123456");
    await user.save();

    res.status(201).json({ message: "User created", id: user._id, email: user.email, roles: user.roles });
  } catch (e) { next(e); }
};

// PUT/PATCH /api/users/:id
export const update = async (req, res, next) => {
  try {
    const { value, error } = updateUserSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const user = await User.findById(req.params.id); // ẩn deleted nhờ middleware
    if (!user) return res.status(404).json({ error: "User not found" });

    if (value.email && value.email !== user.email) {
      const exists = await User.findOne({ email: value.email, _id: { $ne: user._id } });
      if (exists) return res.status(400).json({ error: "Email already in use" });
      user.email = value.email;
    }

    if (value.name != null) user.name = value.name;
    if (value.phone != null) user.phone = value.phone;
    if (value.company !== undefined) user.company = value.company || undefined;
    if (value.hotel   !== undefined) user.hotel   = value.hotel   || undefined;
    if (Array.isArray(value.roles))  user.roles  = value.roles;

    if (value.password && value.password.trim()) {
      await user.setPassword(value.password);
    }

    await user.save();

    const out = await User.findById(user._id)
      .select("-password_hash")
      .populate("company", "name")
      .populate("hotel", "name")
      .lean();

    res.json({ message: "User updated", user: out });
  } catch (e) { next(e); }
};

// DELETE /api/users/:id   (soft delete) | ?force=1 (hard delete)
export const remove = async (req, res, next) => {
  try {
    const { id } = req.params, force = req.query.force === "1";

    if (force) {
      const r = await User.deleteOne({ _id: id });
      if (r.deletedCount === 0) return res.status(404).json({ error: "User not found" });
      return res.json({ message: "User permanently deleted", id });
    }

    const u = await User.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true, projection: { password_hash: 0 }, includeDeleted: true } // override filter
    );
    if (!u) return res.status(404).json({ error: "User not found or already deleted" });

    res.json({ message: "User soft-deleted", id: u._id });
  } catch (e) { next(e); }
};

// PATCH /api/users/:id/restore
export const restore = async (req, res, next) => {
  try {
    const u = await User.findOneAndUpdate(
      { _id: req.params.id, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null } },
      { new: true, projection: { password_hash: 0 }, includeDeleted: true }
    );
    if (!u) return res.status(404).json({ error: "User not found or not deleted" });
    res.json({ message: "User restored", user: u });
  } catch (e) { next(e); }
};
