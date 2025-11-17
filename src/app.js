// import express from "express";
// import morgan from "morgan";
// import cors from "cors";
// import routes from "./routes/index.js";
// import { errorHandler } from "./middlewares/error.middleware.js";

// const app = express();
// app.use(cors());
// app.use(express.json());
// app.use(morgan("dev"));

// app.get("/", (req, res) => res.json({ status: "ok" }));
// app.use("/api", routes);

// // error handler cuối cùng
// app.use(errorHandler);

// export default app;


import express from "express";
import morgan from "morgan";
import cors from "cors";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import "./models/index.js";

const app = express();
app.use("/uploads", express.static("uploads")); 
app.use(cors({ origin: process.env.CORS_ORIGIN || "*"}));
app.use(express.json());
app.use(morgan("dev"));





app.use("/api", routes);    

// error handler cuối
app.use(errorHandler);

export default app;
