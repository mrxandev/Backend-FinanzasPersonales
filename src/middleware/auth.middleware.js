import { pool } from "../db/connection.js";
import { verifyToken } from "../utils/jwt.js";
import { fail } from "../utils/response.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return fail(res, "Token no proporcionado", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    const result = await pool.query(
      `SELECT id, cedula, nombre, email, role, estado, limite_egresos, tipo_persona, fecha_corte
       FROM usuarios
       WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Usuario no encontrado", 401);
    }

    const user = result.rows[0];

    if (user.estado !== "ACTIVO") {
      return fail(res, "Tu cuenta no está activa en el sistema", 403);
    }

    req.user = user;
    next();
  } catch (error) {
    return fail(res, "Token inválido o expirado", 401);
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, "Usuario no autenticado", 401);
    }

    if (!roles.includes(req.user.role)) {
      return fail(res, "No tienes permisos suficientes para realizar esta acción", 403);
    }

    next();
  };
};
