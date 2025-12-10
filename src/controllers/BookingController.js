import { Booking } from "../models/Booking.js";

//get my bookings
export const getMyBookings = async (req, res) => {
  try {
    const userId = req.user.id;
 

    const bookings = await Booking.find({ user: userId })
      .populate("hotel", "name address city")
      .populate("rooms.room", "name roomNumber type capacity bedType")
      .sort({ start_day: -1 });

    res.json(bookings);
  } catch (err) {
    console.error("getMyBookings error:", err);
    res.status(500).json({ error: "Lỗi server khi lấy danh sách đặt phòng" });
  }
};



