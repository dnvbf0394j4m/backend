import "dotenv/config";
import { connectDB } from "../config/db.js";
import { Role } from "../models/Role.js";

const URI = process.env.MONGODB_URI ;

await connectDB(URI);
await Role.bulkWrite([
  { updateOne: { filter: { _id: "ADMIN" }, update: { $set: { description: "Quản trị" } }, upsert: true } },
  { updateOne: { filter: { _id: "STAFF" }, update: { $set: { description: "Nhân viên" } }, upsert: true } },
  { updateOne: { filter: { _id: "USER" },  update: { $set: { description: "Khách/Người dùng" } }, upsert: true } }
]);
console.log("✅ Seed roles done");
process.exit(0);
