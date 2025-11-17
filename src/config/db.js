import mongoose from "mongoose";

export async function connectDB(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { autoIndex: true, serverSelectionTimeoutMS: 10000 });
  console.log("✅ Mongo connected");
}
