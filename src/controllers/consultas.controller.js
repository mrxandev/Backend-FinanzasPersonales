import { pool } from "../db/connection.js";
import { appendFilter, pagination } from "../utils/db.js";
import { fail, ok } from "../utils/response.js";

export const consultarTransacciones = async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const conditions = [];
    const values = [];

    // Filtro por usuario (si no es ADMIN, forzado al usuario autenticado)
    if (req.user.role !== "ADMIN") {
      conditions.push(`t.usuario_id = $${values.length + 1}`);
      values.push(req.user.id);
    } else if (req.query.usuario_id) {
      appendFilter(conditions, values, "t.usuario_id", req.query.usuario_id);
    }

    if (req.query.tipo_transaccion) {
      appendFilter(conditions, values, "t.tipo_transaccion", req.query.tipo_transaccion.toUpperCase());
    }

    if (req.query.estado) {
      appendFilter(conditions, values, "t.estado", req.query.estado.toUpperCase());
    }

    if (req.query.tipo_egreso_id) {
      appendFilter(conditions, values, "ce.tipo_egreso_id", req.query.tipo_egreso_id);
    }

    if (req.query.tipo_ingreso_id) {
      appendFilter(conditions, values, "ci.tipo_ingreso_id", req.query.tipo_ingreso_id);
    }

    if (req.query.renglon_egreso_id) {
      appendFilter(conditions, values, "ce.renglon_egreso_id", req.query.renglon_egreso_id);
    }

    if (req.query.tipo_pago_id) {
      appendFilter(conditions, values, "t.tipo_pago_id", req.query.tipo_pago_id);
    }

    if (req.query.fecha_desde) {
      conditions.push(`t.fecha_transaccion >= $${values.length + 1}`);
      values.push(req.query.fecha_desde);
    }

    if (req.query.fecha_hasta) {
      conditions.push(`t.fecha_transaccion <= $${values.length + 1}`);
      values.push(req.query.fecha_hasta);
    }

    if (req.query.monto_min) {
      conditions.push(`t.monto >= $${values.length + 1}`);
      values.push(parseFloat(req.query.monto_min));
    }

    if (req.query.monto_max) {
      conditions.push(`t.monto <= $${values.length + 1}`);
      values.push(parseFloat(req.query.monto_max));
    }

    if (req.query.busqueda) {
      values.push(`%${req.query.busqueda}%`);
      const idx = values.length;
      conditions.push(
        `(t.numero_transaccion ILIKE $${idx} OR t.comentario ILIKE $${idx} OR ce.descripcion ILIKE $${idx} OR ci.descripcion ILIKE $${idx})`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 1. Obtener métricas y totales acumulados
    const summaryQuery = `
      SELECT
        COUNT(*) AS conteo_total,
        COALESCE(SUM(CASE WHEN t.tipo_transaccion = 'INGRESO' THEN t.monto ELSE 0 END), 0) AS total_ingresos,
        COALESCE(SUM(CASE WHEN t.tipo_transaccion = 'EGRESO' THEN t.monto ELSE 0 END), 0) AS total_egresos,
        COALESCE(SUM(CASE WHEN t.tipo_transaccion = 'INGRESO' AND t.estado = 'APLICADA' THEN t.monto ELSE 0 END), 0) AS total_ingresos_aplicados,
        COALESCE(SUM(CASE WHEN t.tipo_transaccion = 'EGRESO' AND t.estado = 'APLICADA' THEN t.monto ELSE 0 END), 0) AS total_egresos_aplicados,
        COUNT(CASE WHEN t.tipo_transaccion = 'INGRESO' THEN 1 END) AS conteo_ingresos,
        COUNT(CASE WHEN t.tipo_transaccion = 'EGRESO' THEN 1 END) AS conteo_egresos
      FROM transacciones t
      LEFT JOIN conceptos_egresos ce ON ce.id = t.concepto_egreso_id
      LEFT JOIN conceptos_ingresos ci ON ci.id = t.concepto_ingreso_id
      ${whereClause}
    `;

    const summaryResult = await pool.query(summaryQuery, values);
    const summary = summaryResult.rows[0];

    const totalIngresos = parseFloat(summary.total_ingresos_aplicados) || 0;
    const totalEgresos = parseFloat(summary.total_egresos_aplicados) || 0;
    const balanceNeto = totalIngresos - totalEgresos;

    // 2. Obtener lista paginada
    const dataQuery = `
      SELECT
        t.id,
        t.numero_transaccion,
        t.tipo_transaccion,
        t.usuario_id,
        u.nombre AS usuario_nombre,
        u.cedula AS usuario_cedula,
        t.concepto_egreso_id,
        ce.descripcion AS concepto_egreso_descripcion,
        te.descripcion AS tipo_egreso_descripcion,
        re.descripcion AS renglon_egreso_descripcion,
        t.concepto_ingreso_id,
        ci.descripcion AS concepto_ingreso_descripcion,
        ti.descripcion AS tipo_ingreso_descripcion,
        t.tipo_pago_id,
        tp.descripcion AS tipo_pago_descripcion,
        t.fecha_transaccion,
        t.fecha_registro,
        t.monto,
        t.numero_tarjeta_credito,
        t.comentario,
        t.estado,
        t.created_at,
        t.updated_at
      FROM transacciones t
      JOIN usuarios u ON u.id = t.usuario_id
      LEFT JOIN conceptos_egresos ce ON ce.id = t.concepto_egreso_id
      LEFT JOIN tipos_egresos te ON te.id = ce.tipo_egreso_id
      LEFT JOIN renglones_egresos re ON re.id = ce.renglon_egreso_id
      LEFT JOIN conceptos_ingresos ci ON ci.id = t.concepto_ingreso_id
      LEFT JOIN tipos_ingresos ti ON ti.id = ci.tipo_ingreso_id
      LEFT JOIN tipos_pago tp ON tp.id = t.tipo_pago_id
      ${whereClause}
      ORDER BY t.fecha_transaccion DESC, t.fecha_registro DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    const dataResult = await pool.query(dataQuery, [...values, limit, offset]);

    return ok(res, "Consulta analítica ejecutada exitosamente", {
      resumen: {
        conteo_total: parseInt(summary.conteo_total, 10),
        conteo_ingresos: parseInt(summary.conteo_ingresos, 10),
        conteo_egresos: parseInt(summary.conteo_egresos, 10),
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        balance_neto: balanceNeto,
      },
      paginacion: {
        total: parseInt(summary.conteo_total, 10),
        page,
        limit,
      },
      transacciones: dataResult.rows,
    });
  } catch (error) {
    console.error("Error en consultarTransacciones:", error);
    return fail(res, "Error al ejecutar consulta analítica", 500);
  }
};
