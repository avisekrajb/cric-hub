import mongoose from "mongoose";
import env from "./env.js";
import logger from "./logger.js";

mongoose.set("strictQuery", true);

export const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      dbName: env.dbName,
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
    });
    logger.ok(`MongoDB connected → ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    logger.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
mongoose.connection.on("reconnected", () => logger.ok("MongoDB reconnected"));
mongoose.connection.on("error", (err) => logger.error("MongoDB error:", err.message));

export default connectDatabase;
