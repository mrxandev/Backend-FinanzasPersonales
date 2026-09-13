import { env } from "../config/env.js";

export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Ruta no encontrada",
    errors: [`El endpoint ${req.method} ${req.originalUrl} no existe`],
  });
};

export const errorMiddleware = (error, req, res, next) => {
  console.error("Error no manejado:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.publicMessage || "Error interno del servidor",
    errors: env.nodeEnv === "development" ? [error.message] : [],
  });
};
