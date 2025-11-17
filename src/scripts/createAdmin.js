// src/scripts/createAdmin.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";   // chỉnh lại đường dẫn nếu khác
import dotenv from "dotenv";

dotenv.config(); // để load MONGO_URI và các biến .env

async function createAdmin() {
  try {
    const URI = process.env.MONGODB_URI ;
    await mongoose.connect(URI);
    console.log("✅ Connected to MongoDB");

    // Kiểm tra admin đã tồn tại chưa
    const existing = await User.findOne({ email: "admin@gmail.com" });
    if (existing) {
      console.log("⚠️ Admin đã tồn tại rồi!");
      return process.exit(0);
    }

    const passwordHash = await bcrypt.hash("admin123", 10);

    const admin = new User({
      name: "Super Admin",
      email: "admin@gmail.com",
      password_hash: passwordHash,
      roles: ["ADMIN"],
      firstLogin: false,
    });

    await admin.save();
    console.log("🎉 Admin user created successfully!");
    console.log("Email:", admin.email);
    console.log("Password:", "admin123");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

createAdmin();
