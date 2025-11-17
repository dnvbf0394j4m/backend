// scripts/seedHotels.js
import "dotenv/config.js";
import mongoose from "mongoose";
import { Hotel } from "../src/models/Hotel.js";

// Helper: Decimal128
const D128 = (v) => mongoose.Types.Decimal128.fromString(String(v.toFixed(2)));

const SAMPLE = [
  {
    name: "Grand Diamond Hotel",
    description: "Khách sạn trung tâm, gần TTTM, phù hợp công tác & du lịch.",
    address: "12 Lê Lợi, Quận 1, TP.HCM",
    priceHotel: 950000,
    discount: 10,
    lat: 10.7769,
    lng: 106.7009,
    checkInTime: "14:00",
    checkOutTime: "12:00",
  },
  {
    name: "Royal Riverside",
    description: "Bên bờ sông yên tĩnh, phòng nhìn view thoáng.",
    address: "88 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội",
    priceHotel: 1250000,
    discount: 0,
    lat: 21.0285,
    lng: 105.8542,
    checkInTime: "14:00",
    checkOutTime: "12:00",
  },
  {
    name: "Sunrise Resort",
    description: "Resort ven biển, hồ bơi lớn, bãi tắm riêng.",
    address: "Khu Bắc Mỹ An, Ngũ Hành Sơn, Đà Nẵng",
    priceHotel: 1650000,
    discount: 5,
    lat: 16.0471,
    lng: 108.2068,
    checkInTime: "15:00",
    checkOutTime: "12:00",
  },
  {
    name: "Seaside Villa Nha Trang",
    description: "Villa riêng tư, phù hợp gia đình & nhóm bạn.",
    address: "24 Phạm Văn Đồng, Nha Trang",
    priceHotel: 1850000,
    discount: 8,
    lat: 12.2388,
    lng: 109.1967,
    checkInTime: "14:00",
    checkOutTime: "12:00",
  },
  {
    name: "Pearl Phú Quốc",
    description: "Khu nghỉ dưỡng yên bình gần bãi Sao.",
    address: "Ấp Bãi Sao, An Thới, Phú Quốc",
    priceHotel: 2100000,
    discount: 12,
    lat: 10.0493,
    lng: 104.0140,
    checkInTime: "15:00",
    checkOutTime: "12:00",
  },
];

function toDoc(raw, companyId, cityId, areaId) {
  const doc = {
    name: raw.name,
    description: raw.description,
    address: raw.address,
    priceHotel: D128(raw.priceHotel),
    discount: raw.discount ?? 0,
    isDelete: false,
    location: { type: "Point", coordinates: [raw.lng, raw.lat] },
    lat: raw.lat,
    lng: raw.lng,
    checkInTime: raw.checkInTime,
    checkOutTime: raw.checkOutTime,
  };
  if (companyId) doc.company = companyId;
  if (cityId) doc.city = cityId;
  if (areaId) doc.area = areaId;
  return doc;
}

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hotel_db";
  const COMPANY_ID = process.env.SEED_COMPANY_ID || process.argv[2] || null;
  const CITY_ID = process.env.SEED_CITY_ID || null;   // tuỳ chọn
  const AREA_ID = process.env.SEED_AREA_ID || null;   // tuỳ chọn

  if (!COMPANY_ID) {
    console.log("⚠️  Chưa truyền companyId. Vẫn seed được, nhưng Hotel sẽ không có company.");
    console.log("   Bạn có thể truyền bằng:");
    console.log("   - ENV: SEED_COMPANY_ID=<ObjectId>");
    console.log("   - CLI: node scripts/seedHotels.js <ObjectId>");
  }

  await mongoose.connect(uri);
  console.log("✅ Connected:", uri);

  // Tạo 5 bản ghi
  const docs = SAMPLE.map(h => toDoc(h, COMPANY_ID, CITY_ID, AREA_ID));
  const inserted = await Hotel.insertMany(docs);
  console.log(`✅ Seeded ${inserted.length} hotels:`);
  inserted.forEach(h => console.log("-", h._id.toString(), h.name));

  await mongoose.disconnect();
  console.log("✅ Done.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
