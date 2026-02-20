import dotenv from "dotenv";

dotenv.config();

interface Config {
  env: string;
  port: number;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    connectionLimit: number;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || "development",

  port: Number(process.env.PORT) || 5000,

  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "restaurant_db",
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  },
};

export default config;
