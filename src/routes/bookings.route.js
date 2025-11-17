import { Router } from "express";
import dayjs from "dayjs";
import { Booking } from "../models/Booking.js";
import { Room } from "../models/Room.js";
import { User } from "../models/User.js";

const router = Router();

// GET /api/bookings/availability?roomId=...&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
router.get("/availability", async (req, res) => {
  try {
    const { roomId, checkIn, checkOut } = req.query;
    if (!roomId || !checkIn || !checkOut) {
      return res.status(400).json({ error: "roomId, checkIn, checkOut are required" });
    }
    const available = await Booking.isRoomAvailable(roomId, new Date(checkIn), new Date(checkOut));
    res.json({ roomId, available });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/bookings
/*
{
  "customerEmail": "guest@mail.com",  // demo dùng User làm khách (hoặc bạn tách Customer model sau)
  "roomId": "...",
  "checkIn": "2025-11-10",
  "checkOut": "2025-11-12",
  "channel": "ONLINE", // hoặc "STAFF"
  "depositAmount": 500000
}
*/
router.post("/", async (req, res) => {
  const session = await Booking.startSession();
  session.startTransaction();
  try {
    const { customerEmail, roomId, checkIn, checkOut, channel, depositAmount } = req.body;

    if (!customerEmail || !roomId || !checkIn || !checkOut) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const room = await Room.findById(roomId).session(session);
    if (!room || !room.isActive) throw new Error("Room not found or inactive");

    const customer = await User.findOne({ email: customerEmail }).session(session);
    if (!customer) throw new Error("Customer not found (use /auth/register to create)");

    const ci = dayjs(checkIn).startOf("day").toDate();
    const co = dayjs(checkOut).startOf("day").toDate();

    const available = await Booking.isRoomAvailable(room._id, ci, co);
    if (!available) throw new Error("Room is not available in selected time range");

    const nights = dayjs(co).diff(dayjs(ci), "day") || 1;
    const pricePerNight = room.pricePerNight;
    const amount = nights * pricePerNight;

    const booking = await Booking.create([{
      customer: customer._id,
      room: room._id,
      user: null, // nếu là STAFF tạo, set user = staff._id
      checkIn: ci,
      checkOut: co,
      pricePerNight,
      nights,
      amount,
      depositAmount: depositAmount ?? 0,
      channel: channel === "STAFF" ? "STAFF" : "ONLINE",
    }], { session }).then(d => d[0]);

    await session.commitTransaction();
    res.status(201).json(await booking.populate(["room", "customer"]));
  } catch (e) {
    await session.abortTransaction();
    res.status(400).json({ error: e.message });
  } finally {
    session.endSession();
  }
});

export default router;
