import { pool } from "../db/connection.js";
import { appendFilter, pagination } from "../utils/db.js";
import { fail, ok } from "../utils/response.js";
import { createSystemLog } from "../utils/systemLog.js";

const corteSelect = `
  c.id,
  c.usuario_id,
  u.nombre AS usuario_nombre,
  u.cedula AS usuario_cedula,
  c.anio,
  c.mes,
  c.fecha_corte,
  c.balance_inicial,
  c.total_ingresos,
  c.total_egresos,
  c.balance_al_corte,
  c.limite_egresos_periodo,
  c.supero_limite,
  c.estado,
  c.created_at,
  c.updated_at
`;

export const calculatePeriodDates = (anio, mes, fechaCorteDay = 1) => {
  const dia = Math.min(Math.max(Number(fechaCorteDay || 1), 1), 28);
  const year = parseInt(anio, 10);
  const month = parseInt(mes, 10) - 1; // 0-indexed

  if (dia === 1) {
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      fechaCorte: end.toISOString().split("T")[0],
    };
  } else {
    const start = new Date(Date.UTC(year, month - 1, dia + 1));
    const end = new Date(Date.UTC(year, month, dia));
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      fechaCorte: end.toISOString().split("T")[0],
    };
  }
};

export const procesarCorteUsuario = async (client, usuarioId, anio, mes) => {
  const userResult = await client.query(
    "SELECT id, nombre, limite_egresos, fecha_corte FROM usuarios WHERE id = $1",
    [usuarioId]
  );

  if (userResult.rows.length === 0) {
    throw new Error("Usuario no encontrado");
  }

  const user = userResult.rows[0];
  const { startDate, endDate, fechaCorte } = calculatePeriodDates(anio, mes, user.fecha_corte);

  // 1. Obtener balance anterior arrastrado
  const prevCorte = await client.query(
    `SELECT balance_al_corte
     FROM cortes_mensuales
     WHERE usuario_id = $1
       AND (anio < $2 OR (anio = $2 AND mes < $3))
     ORDER BY anio DESC, mes DESC
     LIMIT 1`,
    [usuarioId, anio, mes]
  );

  const balanceInicial = prevCorte.rows.length > 0 ? parseFloat(prevCorte.rows[0].balance_al_corte) : 0.0;

  // 2. Sumar ingresos aplicados del periodo
  const ingresosResult = await client.query(
    `SELECT COALESCE(SUM(monto), 0) AS total_ingresos
     FROM transacciones
     WHERE usuario_id = $1
       AND tipo_transaccion = 'INGRESO'
       AND estado = 'APLICADA'
       AND fecha_transaccion >= $2
       AND fecha_transaccion <= $3`,
    [usuarioId, startDate, endDate]
  );
  const totalIngresos = parseFloat(ingresosResult.rows[0].total_ingresos) || 0.0;

  // 3. Sumar egresos aplicados del periodo
  const egresosResult = await client.query(
    `SELECT COALESCE(SUM(monto), 0) AS total_egresos
     FROM transacciones
     WHERE usuario_id = $1
       AND tipo_transaccion = 'EGRESO'
       AND estado = 'APLICADA'
       AND fecha_transaccion >= $2
       AND fecha_transaccion <= $3`,
    [usuarioId, startDate, endDate]
  );
  const totalEgresos = parseFloat(egresosResult.rows[0].total_egresos) || 0.0;

  // 4. Calcular balance al corte y exceso
  const balanceAlCorte = balanceInicial + totalIngresos - totalEgresos;
  const limitePeriodo = parseFloat(user.limite_egresos) || 0.0;
  const superoLimite = limitePeriodo > 0 && totalEgresos > limitePeriodo;

  // 5. Insertar o actualizar corte mensual
  const upsertResult = await client.query(
    `INSERT INTO cortes_mensuales (
      usuario_id, anio, mes, fecha_corte, balance_inicial,
      total_ingresos, total_egresos, balance_al_corte,
      limite_egresos_periodo, supero_limite, estado
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CERRADO')
    ON CONFLICT (usuario_id, anio, mes)
    DO UPDATE SET
      fecha_corte = EXCLUDED.fecha_corte,
      balance_inicial = EXCLUDED.balance_inicial,
      total_ingresos = EXCLUDED.total_ingresos,
      total_egresos = EXCLUDED.total_egresos,
      balance_al_corte = EXCLUDED.balance_al_corte,
      limite_egresos_periodo = EXCLUDED.limite_egresos_periodo,
      supero_limite = EXCLUDED.supero_limite,
      estado = 'CERRADO',
      updated_at = NOW()
    RETURNING id`,
    [
      usuarioId,
      anio,
      mes,
      fechaCorte,
      balanceInicial,
      totalIngresos,
      totalEgresos,
      balanceAlCorte,
      limitePeriodo,
      superoLimite,
    ]
  );

  return {
    corteId: upsertResult.rows[0].id,
    usuarioId,
    anio,
    mes,
    fechaCorte,
    balanceInicial,
    totalIngresos,
    totalEgresos,
    balanceAlCorte,
    limitePeriodo,
    superoLimite,
    startDate,
    endDate,
  };
};

export const procesarCorte = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let { usuario_id, anio, mes, todos = false } = req.body;

    const now = new Date();
    const targetAnio = parseInt(anio, 10) || now.getFullYear();
    const targetMes = parseInt(mes, 10) || now.getMonth() + 1;

    if (targetMes < 1 || targetMes > 12) {
      await client.query("ROLLBACK");
      return fail(res, "El mes debe estar comprendido entre 1 y 12", 400);
    }

    if (todos && req.user.role === "ADMIN") {
      const activeUsers = await client.query("SELECT id FROM usuarios WHERE estado = 'ACTIVO'");
      const procesados = [];

      for (const u of activeUsers.rows) {
        const corte = await procesarCorteUsuario(client, u.id, targetAnio, targetMes);
        procesados.push(corte);
      }

      await client.query("COMMIT");

      await createSystemLog({
        actorId: req.user.id,
        action: "PROCESAR_CORTE_MASIVO",
        entityType: "CORTE_MENSUAL",
        newValues: { anio: targetAnio, mes: targetMes, total_usuarios: procesados.length },
        req,
      });

      return ok(res, `Cortes procesados exitosamente para ${procesados.length} usuarios`, {
        anio: targetAnio,
        mes: targetMes,
        total_procesados: procesados.length,
        cortes: procesados,
      });
    }

    const targetUserId = req.user.role === "ADMIN" && usuario_id ? usuario_id : req.user.id;

    const resultadoCorte = await procesarCorteUsuario(client, targetUserId, targetAnio, targetMes);

    await client.query("COMMIT");

    const fullCorte = await pool.query(
      `SELECT ${corteSelect}
       FROM cortes_mensuales c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.id = $1`,
      [resultadoCorte.corteId]
    );

    await createSystemLog({
      actorId: req.user.id,
      targetUserId,
      action: "PROCESAR_CORTE_INDIVIDUAL",
      entityType: "CORTE_MENSUAL",
      entityId: resultadoCorte.corteId,
      newValues: { anio: targetAnio, mes: targetMes, balance_al_corte: resultadoCorte.balanceAlCorte },
      req,
    });

    return ok(res, "Corte mensual procesado exitosamente", { corte: fullCorte.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error en procesarCorte:", error);
    return fail(res, error.message || "Error al procesar corte mensual", 500);
  } finally {
    client.release();
  }
};

export const getCortes = async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const conditions = [];
    const values = [];

    if (req.user.role !== "ADMIN") {
      conditions.push(`c.usuario_id = $${values.length + 1}`);
      values.push(req.user.id);
    } else if (req.query.usuario_id) {
      appendFilter(conditions, values, "c.usuario_id", req.query.usuario_id);
    }

    if (req.query.anio) {
      appendFilter(conditions, values, "c.anio", parseInt(req.query.anio, 10));
    }
    if (req.query.mes) {
      appendFilter(conditions, values, "c.mes", parseInt(req.query.mes, 10));
    }
    if (req.query.supero_limite !== undefined) {
      appendFilter(conditions, values, "c.supero_limite", req.query.supero_limite === "true");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM cortes_mensuales c ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT ${corteSelect}
       FROM cortes_mensuales c
       JOIN usuarios u ON u.id = c.usuario_id
       ${whereClause}
       ORDER BY c.anio DESC, c.mes DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return ok(res, "Cortes mensuales obtenidos exitosamente", {
      total,
      page,
      limit,
      cortes: dataResult.rows,
    });
  } catch (error) {
    console.error("Error en getCortes:", error);
    return fail(res, "Error al obtener cortes mensuales", 500);
  }
};

export const getCorteById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT ${corteSelect}
       FROM cortes_mensuales c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Corte mensual no encontrado", 404);
    }

    const corte = result.rows[0];
    if (req.user.role !== "ADMIN" && corte.usuario_id !== req.user.id) {
      return fail(res, "No tienes permiso para ver este corte", 403);
    }

    // Obtener transacciones que componen el corte
    const userResult = await pool.query("SELECT fecha_corte FROM usuarios WHERE id = $1", [corte.usuario_id]);
    const fechaCorteDay = userResult.rows[0]?.fecha_corte || 1;
    const { startDate, endDate } = calculatePeriodDates(corte.anio, corte.mes, fechaCorteDay);

    const transacciones = await pool.query(
      `SELECT
        t.id, t.numero_transaccion, t.tipo_transaccion, t.fecha_transaccion, t.monto,
        t.comentario, ce.descripcion AS concepto_egreso, ci.descripcion AS concepto_ingreso
       FROM transacciones t
       LEFT JOIN conceptos_egresos ce ON ce.id = t.concepto_egreso_id
       LEFT JOIN conceptos_ingresos ci ON ci.id = t.concepto_ingreso_id
       WHERE t.usuario_id = $1
         AND t.estado = 'APLICADA'
         AND t.fecha_transaccion >= $2
         AND t.fecha_transaccion <= $3
       ORDER BY t.fecha_transaccion ASC`,
      [corte.usuario_id, startDate, endDate]
    );

    return ok(res, "Detalle de corte mensual obtenido exitosamente", {
      corte,
      periodo: { startDate, endDate },
      transacciones: transacciones.rows,
    });
  } catch (error) {
    console.error("Error en getCorteById:", error);
    return fail(res, "Error al obtener detalle del corte", 500);
  }
};
