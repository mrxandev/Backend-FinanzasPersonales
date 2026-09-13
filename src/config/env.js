import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "finanzas_personales_secret_jwt_key_2026_super_secure",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  databaseUrl: process.env.DATABASE_URL,
  dbSsl: process.env.DB_SSL === "true" || process.env.NODE_ENV === "production" || Boolean(process.env.DATABASE_URL),
  admin: {
    email: (process.env.ADMIN_EMAIL || "admin@finanzas.unapec.edu.do").toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "Admin123456",
    nombre: process.env.ADMIN_NOMBRE || "Administrador TuFinanzas",
    cedula: process.env.ADMIN_CEDULA || "00100000000",
  },
};
