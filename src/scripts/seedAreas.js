import mongoose from "mongoose";
import { Area } from "../models/Area.js";

const MONGO_URI = "mongodb://127.0.0.1:27017/travelDB";

async function seedAreas() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const data = [
    {
      name: "Quận 1",
      lat: 10.776889,
      lng: 106.700806,
      location: { type: "Point", coordinates: [106.700806, 10.776889] }
    },
    {
      name: "Quận 3",
      lat: 10.784051,
      lng: 106.695305,
      location: { type: "Point", coordinates: [106.695305, 10.784051] }
    },
    {
      name: "Quận 7",
      lat: 10.737997,
      lng: 106.721524,
      location: { type: "Point", coordinates: [106.721524, 10.737997] }
    },
    {
      name: "Hoàn Kiếm",
      lat: 21.028511,
      lng: 105.804817,
      location: { type: "Point", coordinates: [105.804817, 21.028511] }
    },
    {
      name: "Cầu Giấy",
      lat: 21.036236,
      lng: 105.790753,
      location: { type: "Point", coordinates: [105.790753, 21.036236] }
    }
  ];

  await Area.insertMany(data);
  console.log("Inserted 5 areas");

  process.exit(0);
}

seedAreas();
