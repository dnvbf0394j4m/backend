import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 4000;
const URI = process.env.MONGODB_URI ;

await connectDB(URI);
app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
