// src/controllers/adminDashboard.controller.js
import mongoose from "mongoose";
import { Booking, BOOKING_STATUS } from "../models/Booking.js";
import { Hotel } from "../models/Hotel.js";
import { User } from "../models/User.js"; // nhớ có model User

const { ObjectId } = mongoose.Types;

function getCompanyIdFromUser(user) {
  if (!user) return null;
  const c = user.company;
  if (!c) return null;
  if (typeof c === "string") return c;
  if (c._id) return c._id.toString();
  return null;
}


export const getMyHotels = async (req, res) => {
  try {
    const companyId = getCompanyIdFromUser(req.user);
    if (!companyId || !ObjectId.isValid(companyId)) {
      return res
        .status(400)
        .json({ error: "Không xác định được company của admin-hotel" });
    }

    // Lấy tất cả hotel thuộc company này (chưa xoá)
    const hotels = await Hotel.find({
      company: companyId,
      isDelete: false,
    }).select("_id name");

    return res.json({ data: hotels });
  } catch (e) {
    console.error("getMyHotels error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const getAdminHotelDashboard = async (req, res) => {
  try {
    const companyId = getCompanyIdFromUser(req.user);
    if (!companyId || !ObjectId.isValid(companyId)) {
      return res
        .status(400)
        .json({ error: "Không xác định được company của admin-hotel" });
    }

    const { hotel: hotelId, from, to } = req.query;

    // ========== FILTER CHUNG ==========
    const matchBase = {
      isDeleted: false,
      status: { $ne: BOOKING_STATUS.CANCELLED },
      company: new ObjectId(companyId),
    };

    // Nếu chọn 1 hotel cụ thể
    if (hotelId && hotelId !== "ALL" && ObjectId.isValid(hotelId)) {
      matchBase.hotel = new ObjectId(hotelId);
    }

    // filter theo ngày
    let fromDate, toDate;
    if (from) fromDate = new Date(from);
    if (to) {
      toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
    }
    if (fromDate || toDate) {
      matchBase.start_day = {};
      if (fromDate) matchBase.start_day.$gte = fromDate;
      if (toDate) matchBase.start_day.$lt = toDate;
    }

    // ========== SUMMARY ==========
    const summaryAgg = await Booking.aggregate([
      { $match: matchBase },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$paid" },
          totalBookings: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalNights: {
            $sum: {
              $divide: [
                { $subtract: ["$end_day", "$start_day"] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
      },
    ]);

    const summary = summaryAgg[0] || {
      totalRevenue: 0,
      totalBookings: 0,
      totalAmount: 0,
      totalNights: 0,
    };

    // ========== OCCUPANCY ==========
    const now = new Date();
    const matchOccupancy = {
      isDeleted: false,
      status: {
        $in: [
          BOOKING_STATUS.PAID,
          BOOKING_STATUS.PARTIAL,
          BOOKING_STATUS.CHECKED_IN,
        ],
      },
      company: new ObjectId(companyId),
      start_day: { $lte: now },
      end_day: { $gt: now },
    };

    if (hotelId && hotelId !== "ALL" && ObjectId.isValid(hotelId)) {
      matchOccupancy.hotel = new ObjectId(hotelId);
    }

    const occRoomsAgg = await Booking.aggregate([
      { $match: matchOccupancy },
      { $unwind: "$rooms" },
      { $group: { _id: "$rooms.room" } },
      { $count: "occupiedRooms" },
    ]);

    const occupiedRooms = occRoomsAgg[0]?.occupiedRooms || 0;

    // Tổng phòng: tất cả hotel của company (và optional 1 hotel)
    const hotelMatch = {
      company: new ObjectId(companyId),
      isDelete: false,
    };
    if (hotelId && hotelId !== "ALL" && ObjectId.isValid(hotelId)) {
      hotelMatch._id = new ObjectId(hotelId);
    }

    const totalRoomsAgg = await Hotel.aggregate([
      { $match: hotelMatch },
      {
        $project: {
          numRooms: { $size: { $ifNull: ["$room", []] } },
        },
      },
      {
        $group: {
          _id: null,
          totalRooms: { $sum: "$numRooms" },
        },
      },
    ]);

    const totalRooms = totalRoomsAgg[0]?.totalRooms || 0;
    const occupancyRate =
      totalRooms > 0
        ? Number(((occupiedRooms / totalRooms) * 100).toFixed(1))
        : 0;

    // ========== DOANH THU THEO HOTEL ==========
    const revenueByBranch = await Booking.aggregate([
      { $match: matchBase },
      {
        $group: {
          _id: "$hotel",
          revenue: { $sum: "$paid" },
          bookings: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "hotels",
          localField: "_id",
          foreignField: "_id",
          as: "hotel",
        },
      },
      { $unwind: { path: "$hotel", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          name: { $ifNull: ["$hotel.name", "Không rõ khách sạn"] },
          revenue: 1,
          bookings: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // ========== DOANH THU 30 NGÀY ==========
    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);

    const matchLast30 = {
      ...matchBase,
      start_day: {
        $gte: last30,
        ...(matchBase.start_day || {}),
      },
    };

    const revenueLast30Days = await Booking.aggregate([
      { $match: matchLast30 },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%d/%m",
              date: "$start_day",
            },
          },
          revenue: { $sum: "$paid" },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          revenue: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);

    // ========== DOANH THU THEO NHÂN VIÊN ==========
    const staffRevenue = await Booking.aggregate([
      { $match: matchBase },
      {
        $group: {
          _id: "$createdBy",
          bookings: { $sum: 1 },
          revenue: { $sum: "$paid" },
          unpaid: {
            $sum: {
              $cond: [
                { $gt: [{ $subtract: ["$amount", "$paid"] }, 0] },
                { $subtract: ["$amount", "$paid"] },
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          id: "$_id",
          name: { $ifNull: ["$user.name", "Không rõ"] },
          bookings: 1,
          revenue: 1,
          unpaid: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // ========== CẤU TRÚC (để rỗng, sau bạn thêm field thì group) ==========
    const roomTypeStruct = [];
    const customerSourceStruct = [];

    const avgStayHours =
      summary.totalBookings > 0
        ? Number(
            ((summary.totalNights * 24) / summary.totalBookings).toFixed(1)
          )
        : 0;

    return res.json({
      data: {
        todaySummary: {
          revenue: summary.totalRevenue || 0,
          bookings: summary.totalBookings || 0,
          occupiedRooms,
          totalRooms,
          occupancyRate,
          totalCustomers: 0,
          avgStayHours,
        },
        revenueByBranch,
        revenueLast30Days,
        roomTypeStruct,
        customerSourceStruct,
        staffRevenue,
      },
    });
  } catch (e) {
    console.error("AdminHotel dashboard error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
};

