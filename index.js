import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import dotenv from "dotenv";

import { env } from "./src/config/env.js";
import { swaggerSpec } from "./src/config/swagger.js";
import { connectDB } from "./src/db/connection.js";
import { initDatabase } from "./src/db/initDatabase.js";
import { errorMiddleware, notFound } from "./src/middleware/error.middleware.js";

// Rutas de los 12 módulos
import authRoutes from "./src/routes/auth.routes.js";
import usuariosRoutes from "./src/routes/usuarios.routes.js";
import tiposEgresosRoutes from "./src/routes/tipos-egresos.routes.js";
import tiposIngresosRoutes from "./src/routes/tipos-ingresos.routes.js";
import renglonesEgresosRoutes from "./src/routes/renglones-egresos.routes.js";
import tiposPagoRoutes from "./src/routes/tipos-pago.routes.js";
import conceptosEgresosRoutes from "./src/routes/conceptos-egresos.routes.js";
import conceptosIngresosRoutes from "./src/routes/conceptos-ingresos.routes.js";
import transaccionesRoutes from "./src/routes/transacciones.routes.js";
import cortesRoutes from "./src/routes/cortes.routes.js";
import consultasRoutes from "./src/routes/consultas.routes.js";
import reportesRoutes from "./src/routes/reportes.routes.js";

dotenv.config();

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://tufinanzas.vercel.app",
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
      callback(null, true);
      return;
    }
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const app = express();
const PORT = env.port || 3000;

app.use(helmet());
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

// Health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Bienvenido a TuFinanzas API - Sistema de Gestión de Finanzas Personales",
    data: {
      version: "1.0.0",
      status: "operacional",
      docs: "/api-docs",
      spec: "/api-docs.json",
    },
  });
});

// Documentación Swagger / OpenAPI 3.0
app.get("/api-docs.json", (req, res) => {
  res.json(swaggerSpec);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Montaje de las rutas de los 12 módulos
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/tipos-egresos", tiposEgresosRoutes);
app.use("/api/tipos-ingresos", tiposIngresosRoutes);
app.use("/api/renglones-egresos", renglonesEgresosRoutes);
app.use("/api/tipos-pago", tiposPagoRoutes);
app.use("/api/conceptos-egresos", conceptosEgresosRoutes);
app.use("/api/conceptos-ingresos", conceptosIngresosRoutes);
app.use("/api/transacciones", transaccionesRoutes);
app.use("/api/cortes", cortesRoutes);
app.use("/api/consultas", consultasRoutes);
app.use("/api/reportes", reportesRoutes);

// Manejo de rutas 404 y global de errores
app.use(notFound);
app.use(errorMiddleware);

const startServer = async () => {
  try {
    if (process.env.CHECK_SWAGGER !== "true") {
      const isDbConnected = await connectDB();
      if (isDbConnected) {
        await initDatabase();
      } else {
        console.warn("⚠ Servidor arrancando sin base de datos activa.");
      }
    }

    app.listen(PORT, () => {
      console.log(`🚀 TuFinanzas API escuchando en el puerto ${PORT}`);
      console.log(`📖 Documentación Swagger UI disponible en http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error("Error al arrancar el servidor:", error.message);
    if (env.nodeEnv === "production") {
      process.exit(1);
    }
  }
};

startServer();

export default app;
