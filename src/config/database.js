const mongoose = require("mongoose");

// Conecta la aplicación con MongoDB Atlas usando la URI del archivo .env.
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully");
  } catch (error) {
    // Si la conexión falla, detenemos la aplicación.
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
