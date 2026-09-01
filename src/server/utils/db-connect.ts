import mongoose from "mongoose";
import { logger } from "./logger";

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MONGODB_URI must be set in production");
    }
    return "mongodb://localhost:27017/sherymeet";
  }
  return uri;
}

interface GlobalMongoose {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCached: GlobalMongoose;
}

let cached = global.mongooseCached;

if (!cached) {
  cached = global.mongooseCached = { conn: null, promise: null };
}

export async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
    };

    logger.info("Connecting to MongoDB...");
    cached.promise = mongoose.connect(getMongoUri(), opts).then((mongooseInstance) => {
      logger.info("Connected to MongoDB successfully!");
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    logger.error("MongoDB connection failed", e);
    throw e;
  }

  return cached.conn;
}
