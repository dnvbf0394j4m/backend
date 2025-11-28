

import express from "express";
import morgan from "morgan";
import cors from "cors";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import "./models/index.js";
import cookieParser from "cookie-parser";



import {
  loginLimiter,
  bookingLimiter,
  publicApiLimiter,
} from "./middlewares/rateLimit.middleware.js";

const app = express();
app.set("trust proxy", 1);
app.use("/uploads", express.static("uploads"));
// app.use(cors({
//   origin: "http://localhost:5173",
//   credentials: true, // CHO PHÉP GỬI COOKIE
// }));


const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !origin.length || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS: " + origin));
      }
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(morgan("dev"));


// ✅ 1. Giới hạn login: /api/auth/login
app.use("/api/auth/login", loginLimiter);


// ✅ 2. Giới hạn tạo booking online + thanh toán VNPay
//    Đường dẫn thực tế: /api/public/bookings/create-and-pay
app.use("/api/public/bookings/create-and-pay", bookingLimiter);

app.use("/api", routes);

// error handler cuối
app.use(errorHandler);

export default app;
