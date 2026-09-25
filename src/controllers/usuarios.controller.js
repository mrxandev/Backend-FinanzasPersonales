import bcrypt from "bcryptjs";
import { pool } from "../db/connection.js";
import { appendFilter, buildSetClause, pagination } from "../utils/db.js";
import { fail, ok } from "../utils/response.js";
import { createSystemLog } from "../utils/systemLog.js";
import { isValidDominicanCedula, isValidRNC } from "../utils/validation.js";
import { normalizeCedula, publicUserFields } from "./auth.controller.js";

export const getActivePeriodDates = (fechaCorteDay = 1, targetDate = new Date()) => {
  const d = new Date(targetDate);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  const corte = Math.min(Math.max(Number(fechaCorteDay || 1), 1), 28); // tope a 28 para consistencia con febrero

  if (fechaCorteDay === 1) {
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      anio: year,
      mes: month + 1,
    };
  }

  if (day <= corte) {
    const start = new Date(Date.UTC(year, month - 1, corte + 1));
    const end = new Date(Date.UTC(year, month, corte));
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      anio: year,
      mes: month + 1,
    };
  } else {
    const start = new Date(Date.UTC(year, month, corte + 1));
    const end = new Date(Date.UTC(year, month + 1, corte));
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      anio: month === 11 ? year + 1 : year,
      mes: month === 11 ? 1 : month + 2,
    };
  }
};

export const getUsuarios = async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const conditions = [];
    const values = [];

    if (req.query.role) {
      appendFilter(conditions, values, "role", req.query.role);
    }
    if (req.query.estado) {
      appendFilter(conditions, values, "estado", req.query.estado);
    }
    if (req.query.tipo_persona) {
      appendFilter(conditions, values, "tipo_persona", req.query.tipo_persona);
    }
    if (req.query.busqueda) {
      values.push(`%${req.query.busqueda}%`);
      const idx = values.length;
      conditions.push(`(nombre ILIKE $${idx} OR email ILIKE $${idx} OR cedula ILIKE $${idx})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM usuarios ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT ${publicUserFields}
       FROM usuarios
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return ok(res, "Usuarios obtenidos exitosamente", {
      total,
      page,
      limit,
      usuarios: dataResult.rows,
    });
  } catch (error) {
    console.error("Error en getUsuarios:", error);
    return fail(res, "Error al obtener los usuarios", 500);
  }
};

export const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;

    // Solo ADMIN o el propio usuario
    if (req.user.role !== "ADMIN" && req.user.id !== id) {
      return fail(res, "No tienes permiso para ver este usuario", 403);
    }

    const result = await pool.query(
      `SELECT ${publicUserFields} FROM usuarios WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Usuario no encontrado", 404);
    }

    return ok(res, "Usuario obtenido exitosamente", { usuario: result.rows[0] });
  } catch (error) {
    console.error("Error en getUsuarioById:", error);
    return fail(res, "Error al obtener el usuario", 500);
  }
};

export const createUsuario = async (req, res) => {
  try {
    let {
      cedula,
      nombre,
      email,
      password,
      tipo_persona = "FISICA",
      limite_egresos = 0,
      fecha_corte = 1,
      role = "USER",
      estado = "ACTIVO",
    } = req.body;

    if (!cedula || !nombre || !email || !password) {
      return fail(res, "Cédula, nombre, email y contraseña son obligatorios", 400);
    }

    cedula = normalizeCedula(cedula);
    email = email.trim().toLowerCase();
    nombre = nombre.trim();
    fecha_corte = parseInt(fecha_corte, 10) || 1;
    const lim = parseFloat(limite_egresos);

    if (isNaN(lim) || lim < 0) {
      return fail(res, "El límite mensual de egresos debe ser mayor o igual a RD$ 0.00", 400);
    }

    if (lim > 999999999999.99) {
      return fail(res, "El límite mensual de egresos no puede superar los RD$ 999,999,999,999.99", 400);
    }

    if (fecha_corte < 1 || fecha_corte > 31) {
      return fail(res, "El día de corte debe ser un número entre 1 y 31", 400);
    }

    if (cedula.length !== 9 && cedula.length !== 11) {
      return fail(res, "La cédula debe tener 11 dígitos o el RNC 9 dígitos", 400);
    }

    if (cedula.length === 11 && !isValidDominicanCedula(cedula)) {
      return fail(res, "La cédula ingresada no es válida según el algoritmo de verificación dominicano (Módulo 10)", 400);
    }

    if (cedula.length === 9 && !isValidRNC(cedula)) {
      return fail(res, "El RNC ingresado no es válido según el algoritmo de verificación dominicano", 400);
    }

    const existingUser = await pool.query(
      "SELECT id FROM usuarios WHERE email = $1 OR cedula = $2",
      [email, cedula]
    );

    if (existingUser.rows.length > 0) {
      return fail(res, "El correo electrónico o la cédula ya se encuentran registrados", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO usuarios (cedula, nombre, email, password, role, estado, tipo_persona, limite_egresos, fecha_corte)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${publicUserFields}`,
      [cedula, nombre, email, hashedPassword, role, estado, tipo_persona.toUpperCase(), limite_egresos, fecha_corte]
    );

    await createSystemLog({
      actorId: req.user.id,
      targetUserId: result.rows[0].id,
      action: "ADMIN_CREATE_USER",
      entityType: "USUARIO",
      entityId: result.rows[0].id,
      newValues: { email, role, limite_egresos },
      req,
    });

    return ok(res, "Usuario creado exitosamente por el administrador", { usuario: result.rows[0] }, 201);
  } catch (error) {
    console.error("Error en createUsuario:", error);
    return fail(res, "Error al crear el usuario", 500);
  }
};

export const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "ADMIN" && req.user.id !== id) {
      return fail(res, "No tienes permiso para modificar este usuario", 403);
    }

    const allowedFields = ["nombre", "limite_egresos", "tipo_persona", "fecha_corte"];
    if (req.user.role === "ADMIN") {
      allowedFields.push("role", "estado");
    }

    if (req.body.limite_egresos !== undefined) {
      const lim = parseFloat(req.body.limite_egresos);
      if (isNaN(lim) || lim < 0) {
        return fail(res, "El límite mensual de egresos debe ser mayor o igual a RD$ 0.00", 400);
      }
      if (lim > 999999999999.99) {
        return fail(res, "El límite mensual de egresos no puede superar los RD$ 999,999,999,999.99", 400);
      }
    }

    if (req.body.fecha_corte !== undefined) {
      const corteDay = parseInt(req.body.fecha_corte, 10);
      if (isNaN(corteDay) || corteDay < 1 || corteDay > 31) {
        return fail(res, "El día de corte debe ser un número entre 1 y 31", 400);
      }
    }

    const { fields, values, setClause } = buildSetClause(req.body, allowedFields);

    if (fields.length === 0) {
      return fail(res, "No se enviaron campos válidos para actualizar", 400);
    }

    const previousUser = await pool.query("SELECT * FROM usuarios WHERE id = $1", [id]);
    if (previousUser.rows.length === 0) {
      return fail(res, "Usuario no encontrado", 404);
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING ${publicUserFields}`,
      [...values, id]
    );

    await createSystemLog({
      actorId: req.user.id,
      targetUserId: id,
      action: "UPDATE_USER",
      entityType: "USUARIO",
      entityId: id,
      oldValues: {
        limite_egresos: previousUser.rows[0].limite_egresos,
        role: previousUser.rows[0].role,
        estado: previousUser.rows[0].estado,
      },
      newValues: req.body,
      req,
    });

    return ok(res, "Usuario actualizado exitosamente", { usuario: result.rows[0] });
  } catch (error) {
    console.error("Error en updateUsuario:", error);
    return fail(res, "Error al actualizar el usuario", 500);
  }
};

export const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await pool.query("SELECT id, email FROM usuarios WHERE id = $1", [id]);
    if (userResult.rows.length === 0) {
      return fail(res, "Usuario no encontrado", 404);
    }

    await pool.query("DELETE FROM usuarios WHERE id = $1", [id]);

    await createSystemLog({
      actorId: req.user.id,
      targetUserId: id,
      action: "DELETE_USER",
      entityType: "USUARIO",
      entityId: id,
      oldValues: { email: userResult.rows[0].email },
      req,
    });

    return ok(res, "Usuario eliminado exitosamente", { id });
  } catch (error) {
    console.error("Error en deleteUsuario:", error);
    return fail(res, "Error al eliminar el usuario", 500);
  }
};

export const getLimiteStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "ADMIN" && req.user.id !== id) {
      return fail(res, "No tienes permiso para ver el estado de límite de este usuario", 403);
    }

    const userResult = await pool.query(
      "SELECT id, nombre, email, limite_egresos, fecha_corte FROM usuarios WHERE id = $1",
      [id]
    );

    if (userResult.rows.length === 0) {
      return fail(res, "Usuario no encontrado", 404);
    }

    const user = userResult.rows[0];
    const limiteEgresos = parseFloat(user.limite_egresos) || 0;
    const period = getActivePeriodDates(user.fecha_corte);

    const expenseQuery = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total_gastado
       FROM transacciones
       WHERE usuario_id = $1
         AND tipo_transaccion = 'EGRESO'
         AND estado = 'APLICADA'
         AND fecha_transaccion >= $2
         AND fecha_transaccion <= $3`,
      [id, period.startDate, period.endDate]
    );

    const totalGastado = parseFloat(expenseQuery.rows[0].total_gastado) || 0;
    const saldoRestante = Math.max(0, limiteEgresos - totalGastado);
    const exceso = Math.max(0, totalGastado - limiteEgresos);
    const superoLimite = limiteEgresos > 0 && totalGastado > limiteEgresos;
    const porcentajeConsumido = limiteEgresos > 0 ? parseFloat(((totalGastado / limiteEgresos) * 100).toFixed(2)) : 0;

    return ok(res, "Estado del límite de egresos consultado exitosamente", {
      usuario_id: user.id,
      nombre: user.nombre,
      limite_egresos: limiteEgresos,
      total_gastado: totalGastado,
      saldo_restante: saldoRestante,
      exceso,
      supero_limite: superoLimite,
      porcentaje_consumido: porcentajeConsumido,
      periodo: {
        fecha_desde: period.startDate,
        fecha_hasta: period.endDate,
        anio: period.anio,
        mes: period.mes,
        dia_corte: user.fecha_corte,
      },
    });
  } catch (error) {
    console.error("Error en getLimiteStatus:", error);
    return fail(res, "Error al consultar el estado del límite", 500);
  }
};
