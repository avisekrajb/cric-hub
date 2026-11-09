import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI;
console.log("Connecting to Atlas…");
try {
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "bethub", serverSelectionTimeoutMS: 15000 });
  console.log("Atlas OK —", mongoose.connection.host, "db:", mongoose.connection.name);
  await mongoose.disconnect();
} catch (e) {
  console.error("Atlas FAILED —", e.message);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
try {
  const ping = await cloudinary.api.ping();
  console.log("Cloudinary OK —", ping.status);
} catch (e) {
  console.error("Cloudinary FAILED —", e.message);
}
