// src/controllers/bookingPublic.controller.js
import crypto from "crypto";
import qs from "qs";
import moment from "moment";

import { Booking, BOOKING_STATUS } from "../models/Booking.js";
import { Hotel } from "../models/Hotel.js";
import { Room } from "../models/Room.js";

import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";

// helper tính số đêm
const nightsBetween = (a, b) => {
    const d1 = new Date(a); const d2 = new Date(b);
    const ms = d2.setHours(12, 0, 0, 0) - d1.setHours(12, 0, 0, 0);
    return Math.max(1, Math.ceil(ms / 86400000));
};

// helper sinh URL VNPay

// helper sinh URL VNPay (chuẩn theo sample VNPay)
function buildVnpayUrl({ amount, orderInfo, txnRef, ipAddr }) {
    const vnp_TmnCode = process.env.VNP_TMN_CODE;
    const vnp_HashSecret = process.env.VNP_HASH_SECRET;
    const vnp_Url = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const vnp_ReturnUrl = process.env.VNP_RETURN_URL || "http://localhost:4000/api/payment/vnpay-return";

    // 1) Tạo params gốc
    let vnp_Params = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: vnp_TmnCode,
        vnp_Locale: "vn",
        vnp_CurrCode: "VND",
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: "hotel",
        vnp_Amount: amount * 100,   // VNPay yêu cầu *100
        vnp_ReturnUrl: vnp_ReturnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: moment().format("YYYYMMDDHHmmss"),
    };

    // 2) Sort + encode từng value theo mẫu VNPay
    const sorted = {};
    Object.keys(vnp_Params)
        .sort()
        .forEach((key) => {
            sorted[key] = encodeURIComponent(vnp_Params[key]).replace(/%20/g, "+");
        });

    // 3) Tạo chuỗi ký (không encode thêm)
    const signData = qs.stringify(sorted, { encode: false });

    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const signed = hmac.update(signData, "utf-8").digest("hex");

    // 4) Gắn vnp_SecureHash vào params
    sorted["vnp_SecureHash"] = signed;

    // 5) Build URL (không encode thêm lần nữa)
    const paymentUrl = vnp_Url + "?" + qs.stringify(sorted, { encode: false });

    // (tuỳ chọn) log ra để debug
    console.log("VNPay signData:", signData);
    console.log("VNPay url:", paymentUrl);

    return paymentUrl;
}



/**
 * PUBLIC: khách tự đặt online + tạo URL VNPay
 * POST /api/public/bookings/create-and-pay
 * body: {
 *   hotel, room, start_day, end_day,
 *   customer: { name, phone, email },
 *   note?
 * }
 */
export const createOnlineAndPay = async (req, res, next) => {
    try {
        const { hotel, room, start_day, end_day, customer, note } = req.body || {};
        console.log("Create online booking:", req.body);

        if (!hotel || !room || !start_day || !end_day || !customer?.name || !customer?.phone) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const h = await Hotel.findById(hotel);
        if (!h) return res.status(404).json({ error: "Hotel not found" });

        const r = await Room.findById(room);
        if (!r || String(r.hotel) !== String(hotel)) {
            return res.status(400).json({ error: "Room not found or not belong to hotel" });
        }

     

        const start = new Date(start_day);
        const end = new Date(end_day);
        if (!(end > start)) {
            return res.status(400).json({ error: "end_day must be after start_day" });
        }

        // kiểm tra phòng trống (dùng lại logic từ assertRoomsBelongToHotelAndFree)
        const clash = await Booking.exists({
            isDeleted: false,
            hotel,
            status: { $nin: [BOOKING_STATUS.CANCELLED] },
            start_day: { $lt: end },
            end_day: { $gt: start },
            "rooms.room": room,
        });
        if (clash) {
            return res.status(400).json({ error: "Room is not available in the given dates" });
        }

        // tính tiền: giá phòng * số đêm (cho 1 phòng, bạn có thể thêm room_num nếu muốn)
        const nights = nightsBetween(start, end);
        const amount = r.price * nights;

        const userId = req.user?.id;
        
        // tạo booking PENDING, paid=0
        const booking = await Booking.create({
            hotel,
            company: h.company || undefined,
            customer,
            rooms: [{ room: r._id, price: r.price }],
            start_day: start,
            end_day: end,
            amount,
            paid: 0,
            status: BOOKING_STATUS.PENDING,
            createdBy: null, // khách lẻ online, không phải staff
            note: note || "",
            payments: [],
            user: userId || undefined,
        });

        const ipAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
        const paymentUrl = buildVnpayUrl({
            amount,
            orderInfo: `Thanh toan dat phong ${h.name}`,

            txnRef: booking._id.toString(),
            ipAddr,
        });

        // Lấy danh sách admin/staff của khách sạn
        const hotelUsers = await User.find({
            hotel: booking.hotel,
            roles: { $in: ["ADMIN_HOTEL", "STAFF"] }
        });

        const notifications = hotelUsers.map((u) => ({
            user: u._id,
            hotel: booking.hotel,
            type: "NEW_BOOKING",
            booking: booking._id,
            message: `Có đơn đặt phòng mới từ khách hàng ${booking.customer?.name || "User"}`,
        }));

        await Notification.insertMany(notifications);



        return res.status(201).json({
            bookingId: booking._id,
            amount,
            paymentUrl,
        });
    } catch (err) {
        next(err);
    }
};



export const publicBookingDetail = async (req, res, next) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findById(id)
            .populate("hotel", "name address")
            .populate("rooms.room", "name number")
            .lean();

        if (!booking || booking.isDeleted) {
            return res.status(404).json({ error: "Booking not found" });
        }

        res.json(booking);
    } catch (e) {
        console.error("Public booking detail error:", e);
        next(e);
    }
};
