import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error("MongoDB URI is not defined in environment variables");
    }

    const connect = await mongoose.connect(mongoURI);

    console.log(`MongoDB Connected: ${connect.connection.host}`);
  } catch (error) {
    console.error(
      `Error connecting to MongoDB: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    process.exit(1);
  }
};

export default connectDB;
