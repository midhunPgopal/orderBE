import mysql from "mysql2/promise";
import config from "./config";

/**
 * Create MySQL connection pool
 */
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
});

/**
 * Test Database Connection
 */
export const connectDB = async (): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ MySQL Database connected successfully");
    connection.release();
  } catch (error) {
    console.error("❌ MySQL Database connection failed:", error);
    process.exit(1);
  }
};
