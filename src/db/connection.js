import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

const poolConfig = env.databaseUrl
  ? {
      connectionString: env.databaseUrl,
      ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || "postgres",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
      ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    };

export const pool = new Pool(poolConfig);

export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log("✔ Base de Datos PostgreSQL conectada exitosamente");
    client.release();
    return true;
  } catch (error) {
    console.error("⚠ No se pudo conectar a PostgreSQL:", error.message);
    if (env.nodeEnv === "production") {
      process.exit(1);
    }
    return false;
  }
};
