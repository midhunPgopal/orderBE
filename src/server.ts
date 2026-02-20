import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import config from "./config/config";
import { connectDB, pool } from "./config/db";
import authRoutes from "./modules/auth/auth.routes";
import menuRoutes from "./modules/menu/menu.routes";
import orderRoutes from "./modules/orders/orders.route";
import { authenticate } from "./middlewares/auth.middleware";
import cookieParser from "cookie-parser";

const app: Application = express();

//Global Middlewares
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(cookieParser());

//Health Check Endpoint
app.get("/health", async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query("SELECT NOW() as now");

    res.status(200).json({
      status: "OK",
      database: "Connected",
      dbTime: (rows as any)[0].now,
      uptime: process.uptime(),
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Health check failed:", error);

    res.status(500).json({
      status: "ERROR",
      database: "Disconnected",
    });
  }
});

//routes
app.use("/api/auth", authRoutes);
app.use("/api/menu", authenticate, menuRoutes);
app.use("/api/orders", authenticate, orderRoutes);

//Global Error Handler
app.use(
  (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
);

//server starting function
const startServer = async () => {
  try {
    await connectDB();

    app.listen(config.port, () => {
      console.log("=================================");
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`🌱 Environment: ${config.env}`);
      console.log("=================================");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

process.on("SIGINT", async () => {
  console.log("🛑 Gracefully shutting down...");
  await pool.end();
  process.exit(0);
});
