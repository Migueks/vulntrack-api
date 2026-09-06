require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/database");

const PORT = process.env.PORT || 3000;

// Conectamos primero con MongoDB y después levantamos el servidor.
const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`VulnTrack API running on http://localhost:${PORT}`);
  });
};

startServer();
