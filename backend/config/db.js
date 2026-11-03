
const mongoose = require("mongoose");
require("dotenv").config();

const dbconnect = async () => {
  try {
    const mongoURL = process.env.MONGODB_URL;

    if (!mongoURL) {
      throw new Error("MONGODB_URL is missing");
    }

    if (mongoose.connection.readyState === 1) {
      return;
    }

    await mongoose.connect(mongoURL, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB connected successfully!");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

module.exports = dbconnect;
