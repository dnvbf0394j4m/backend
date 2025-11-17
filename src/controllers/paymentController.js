import crypto from "crypto";
import qs from "qs";
import { Booking, BOOKING_STATUS } from "../models/Booking.js";
import { sendMail } from "../utils/sendMail.js";
export const vnpReturn = async (req, res, next) => {
  try {
    const vnp_HashSecret = process.env.VNP_HASH_SECRET;

    // Clone query params
    let vnp_Params = { ...req.query };
    const secureHash = vnp_Params.vnp_SecureHash;

    // Remove hash fields before signing
    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    // Decode parameters to correct format before signing
    Object.keys(vnp_Params).forEach(key => {
      vnp_Params[key] = decodeURIComponent(vnp_Params[key]).replace(/ /g, "+");
    });

    // Sort params
    vnp_Params = Object.keys(vnp_Params).sort().reduce((acc, key) => {
      acc[key] = vnp_Params[key];
      return acc;
    }, {});

    // Build sign data
    const signData = qs.stringify(vnp_Params, { encode: false });
    const signed = crypto
      .createHmac("sha512", vnp_HashSecret)
      .update(signData, "utf-8")
      .digest("hex");

    console.log("Client SecureHash:", secureHash);
    console.log("Server Signed Hash:", signed);

    // Compare
    if (secureHash !== signed) {
      console.error("❌ VNPay return: invalid signature");
      return res.redirect("http://localhost:5173/payment/fail?reason=invalid-signature");
    }

    const rspCode = vnp_Params.vnp_ResponseCode;
    const txnStatus = vnp_Params.vnp_TransactionStatus;
    const bookingId = vnp_Params.vnp_TxnRef;

    // Success
    if (rspCode === "00" && txnStatus === "00") {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        const paidAmount = Number(vnp_Params.vnp_Amount || 0) / 100;

        booking.paid = (booking.paid || 0) + paidAmount;
        if (booking.paid > booking.amount) booking.paid = booking.amount;

        // Update status
        if (booking.paid <= 0) booking.status = BOOKING_STATUS.PENDING;
        else if (booking.paid < booking.amount) booking.status = BOOKING_STATUS.PARTIAL;
        else booking.status = BOOKING_STATUS.PAID;

        booking.payments.push({
          method: "VNPAY",
          amount: paidAmount,
          note: `VNPay ${vnp_Params.vnp_BankCode || ""} - trans: ${vnp_Params.vnp_TransactionNo || ""}`,
          by: null,
          at: new Date(),
        });

        await booking.save();


        // // Send email to customer
        // await sendMail(
        //   booking.customer.email,
        //   "Xác nhận đặt phòng thành công",
        //   `
        // <h2>Chúc mừng, bạn đã đặt phòng thành công!</h2>
        // <p>Khách sạn: <b>${booking.hotel.name}</b></p>
        // <p>Phòng: <b>${booking.rooms[0].room.name}</b></p>
        // <p>Check-in: <b>${booking.start_day.toLocaleDateString()}</b></p>
        // <p>Check-out: <b>${booking.end_day.toLocaleDateString()}</b></p>
        // <p>Tổng tiền: <b>${paidAmount.toLocaleString("vi-VN")} VND</b></p>
        // <br>
        // <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi ❤️</p>
        // `
        // );
      }

      return res.redirect(`http://localhost:5173/payment/success?booking_id=${bookingId}`);
    }

    // Fail
    return res.redirect(
      `http://localhost:5173/payment/fail?booking_id=${bookingId}&code=${rspCode || ""}`
    );

  } catch (e) {
    console.error("VNPay return error:", e);
    next(e);
  }
};

