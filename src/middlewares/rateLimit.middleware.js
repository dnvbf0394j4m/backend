// src/middlewares/rateLimit.middleware.js
import rateLimit from "express-rate-limit";

/**
 * Giới hạn số lần login để chống brute-force
 * - Mỗi IP chỉ được login tối đa 20 lần trong 15 phút
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5,                  // tối đa 20 request / 15 phút / IP
  standardHeaders: true,    // thêm header X-RateLimit-*
  legacyHeaders: false,
  message: {
    error: "Too many login attempts, please try again later.",
  },
}); 

/**
 * Giới hạn tạo booking online + VNPay để chống spam
 * - Mỗi IP chỉ được tạo tối đa 5 booking trong 10 phút
 */
export const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 phút
  max: 5,                   // tối đa 5 request / 10 phút / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many booking requests, please try again later.",
  },
});

/**
 * (Tuỳ chọn) Giới hạn chung cho các API public khác
 * Ví dụ: tránh spam search hotel, search room...
 */
export const publicApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 60,                 // 60 request / phút / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please slow down.",
  },
});
