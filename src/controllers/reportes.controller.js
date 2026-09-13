import { pool } from "../db/connection.js";
import { fail, ok } from "../utils/response.js";
import { calculatePeriodDates } from "./cortes.controller.js";

export const getReporteCortes = async (req, res) => {
  try {
    const targetUserId = req.user.role === "ADMIN" && req.query.usuario_id ? req.query.usuario_id : req.user.id;
    const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();

    const result = await pool.query(
      `SELECT
        c.id, c.usuario_id, u.nombre AS usuario_nombre, u.cedula AS usuario_cedula,
        c.anio, c.mes, c.fecha_corte, c.balance_inicial, c.total_ingresos, c.total_egresos,
        c.balance_al_corte, c.limite_egresos_periodo, c.supero_limite,
        CASE
          WHEN c.limite_egresos_periodo > 0 THEN ROUND((c.total_egresos / c.limite_egresos_periodo) * 100, 2)
          ELSE 0
        END AS porcentaje_consumo_limite
       FROM cortes_mensuales c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE (c.usuario_id = $1 OR $2 = 'ADMIN')
         AND c.anio = $3
       ORDER BY c.anio DESC, c.mes ASC`,
      [targetUserId, req.user.role, anio]
    );

    // Métricas consolidadas del reporte
    const totalIngresos = result.rows.reduce((acc, row) => acc + parseFloat(row.total_ingresos || 0), 0);
    const totalEgresos = result.rows.reduce((acc, row) => acc + parseFloat(row.total_egresos || 0), 0);
    const superoLimiteCount = result.rows.filter((row) => row.supero_limite).length;

    return ok(res, "Reporte consolidado de cortes obtenido exitosamente", {
      anio,
      totales_consolidados: {
        total_periodos_cerrados: result.rows.length,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        balance_neto_acumulado: totalIngresos - totalEgresos,
        meses_supero_limite: superoLimiteCount,
      },
      cortes: result.rows,
    });
  } catch (error) {
    console.error("Error en getReporteCortes:", error);
    return fail(res, "Error al generar reporte de cortes", 500);
  }
};

export const getReporteCorteDetallado = async (req, res) => {
  try {
    const { id } = req.params;

    const corteQuery = await pool.query(
      `SELECT
        c.id, c.usuario_id, u.nombre AS usuario_nombre, u.cedula AS usuario_cedula,
        u.fecha_corte AS dia_corte_usuario,
        c.anio, c.mes, c.fecha_corte, c.balance_inicial, c.total_ingresos, c.total_egresos,
        c.balance_al_corte, c.limite_egresos_periodo, c.supero_limite
       FROM cortes_mensuales c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.id = $1`,
      [id]
    );

    if (corteQuery.rows.length === 0) {
      return fail(res, "Corte mensual no encontrado", 404);
    }

    const corte = corteQuery.rows[0];
    if (req.user.role !== "ADMIN" && corte.usuario_id !== req.user.id) {
      return fail(res, "No tienes permiso para ver el reporte de este corte", 403);
    }

    const { startDate, endDate } = calculatePeriodDates(corte.anio, corte.mes, corte.dia_corte_usuario);

    // 1. Desglose de egresos por renglón
    const egresosPorRenglonQuery = await pool.query(
      `SELECT
        re.id AS renglon_id,
        re.descripcion AS renglon,
        COALESCE(SUM(t.monto), 0) AS total,
        COUNT(t.id) AS transacciones_count
       FROM transacciones t
       JOIN conceptos_egresos ce ON ce.id = t.concepto_egreso_id
       JOIN renglones_egresos re ON re.id = ce.renglon_egreso_id
       WHERE t.usuario_id = $1
         AND t.tipo_transaccion = 'EGRESO'
         AND t.estado = 'APLICADA'
         AND t.fecha_transaccion >= $2
         AND t.fecha_transaccion <= $3
       GROUP BY re.id, re.descripcion
       ORDER BY total DESC`,
      [corte.usuario_id, startDate, endDate]
    );

    const totalEgresos = parseFloat(corte.total_egresos) || 0;
    const egresosPorRenglon = egresosPorRenglonQuery.rows.map((row) => ({
      ...row,
      total: parseFloat(row.total),
      transacciones_count: parseInt(row.transacciones_count, 10),
      porcentaje_del_total: totalEgresos > 0 ? parseFloat(((parseFloat(row.total) / totalEgresos) * 100).toFixed(2)) : 0,
    }));

    // 2. Desglose de ingresos por tipo de ingreso
    const ingresosPorTipoQuery = await pool.query(
      `SELECT
        ti.id AS tipo_ingreso_id,
        ti.descripcion AS tipo_ingreso,
        COALESCE(SUM(t.monto), 0) AS total,
        COUNT(t.id) AS transacciones_count
       FROM transacciones t
       JOIN conceptos_ingresos ci ON ci.id = t.concepto_ingreso_id
       JOIN tipos_ingresos ti ON ti.id = ci.tipo_ingreso_id
       WHERE t.usuario_id = $1
         AND t.tipo_transaccion = 'INGRESO'
         AND t.estado = 'APLICADA'
         AND t.fecha_transaccion >= $2
         AND t.fecha_transaccion <= $3
       GROUP BY ti.id, ti.descripcion
       ORDER BY total DESC`,
      [corte.usuario_id, startDate, endDate]
    );

    const totalIngresos = parseFloat(corte.total_ingresos) || 0;
    const ingresosPorTipo = ingresosPorTipoQuery.rows.map((row) => ({
      ...row,
      total: parseFloat(row.total),
      transacciones_count: parseInt(row.transacciones_count, 10),
      porcentaje_del_total: totalIngresos > 0 ? parseFloat(((parseFloat(row.total) / totalIngresos) * 100).toFixed(2)) : 0,
    }));

    // 3. Desglose por tipo de pago
    const porTipoPagoQuery = await pool.query(
      `SELECT
        tp.id AS tipo_pago_id,
        tp.descripcion AS tipo_pago,
        COALESCE(SUM(t.monto), 0) AS total,
        COUNT(t.id) AS transacciones_count
       FROM transacciones t
       LEFT JOIN tipos_pago tp ON tp.id = t.tipo_pago_id
       WHERE t.usuario_id = $1
         AND t.estado = 'APLICADA'
         AND t.fecha_transaccion >= $2
         AND t.fecha_transaccion <= $3
       GROUP BY tp.id, tp.descripcion
       ORDER BY total DESC`,
      [corte.usuario_id, startDate, endDate]
    );

    return ok(res, "Reporte detallado del corte mensual generado exitosamente", {
      corte,
      periodo: {
        fecha_desde: startDate,
        fecha_hasta: endDate,
      },
      desglose_egresos_por_renglon: egresosPorRenglon,
      desglose_ingresos_por_tipo: ingresosPorTipo,
      desglose_por_tipo_pago: porTipoPagoQuery.rows.map((r) => ({
        ...r,
        total: parseFloat(r.total),
        transacciones_count: parseInt(r.transacciones_count, 10),
      })),
    });
  } catch (error) {
    console.error("Error en getReporteCorteDetallado:", error);
    return fail(res, "Error al generar reporte detallado de corte", 500);
  }
};

export const getReporteLimites = async (req, res) => {
  try {
    const targetUserId = req.user.role === "ADMIN" && req.query.usuario_id ? req.query.usuario_id : req.user.id;

    const query = `
      SELECT
        u.id AS usuario_id,
        u.nombre,
        u.cedula,
        u.limite_egresos,
        COUNT(c.id) AS total_cortes_evaluados,
        COUNT(CASE WHEN c.supero_limite = true THEN 1 END) AS cortes_con_exceso,
        COALESCE(AVG(c.total_egresos), 0) AS gasto_mensual_promedio,
        COALESCE(MAX(c.total_egresos), 0) AS gasto_mensual_maximo,
        COALESCE(AVG(CASE WHEN c.supero_limite = true THEN (c.total_egresos - c.limite_egresos_periodo) END), 0) AS exceso_promedio
      FROM usuarios u
      LEFT JOIN cortes_mensuales c ON c.usuario_id = u.id
      WHERE (u.id = $1 OR $2 = 'ADMIN')
        AND u.limite_egresos > 0
      GROUP BY u.id, u.nombre, u.cedula, u.limite_egresos
      ORDER BY cortes_con_exceso DESC, u.nombre ASC
    `;

    const result = await pool.query(query, [targetUserId, req.user.role]);

    const formatted = result.rows.map((r) => ({
      usuario_id: r.usuario_id,
      nombre: r.nombre,
      cedula: r.cedula,
      limite_egresos: parseFloat(r.limite_egresos),
      total_cortes_evaluados: parseInt(r.total_cortes_evaluados, 10),
      cortes_con_exceso: parseInt(r.cortes_con_exceso, 10),
      gasto_mensual_promedio: parseFloat(parseFloat(r.gasto_mensual_promedio).toFixed(2)),
      gasto_mensual_maximo: parseFloat(r.gasto_mensual_maximo),
      exceso_promedio: parseFloat(parseFloat(r.exceso_promedio).toFixed(2)),
    }));

    return ok(res, "Reporte de cumplimiento de límites obtenido exitosamente", {
      total_usuarios_con_limite: formatted.length,
      usuarios: formatted,
    });
  } catch (error) {
    console.error("Error en getReporteLimites:", error);
    return fail(res, "Error al obtener reporte de límites", 500);
  }
};

export const getResumenAnual = async (req, res) => {
  try {
    const targetUserId = req.user.role === "ADMIN" && req.query.usuario_id ? req.query.usuario_id : req.user.id;
    const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();

    const meses = Array.from({ length: 12 }, (_, i) => i + 1);

    const cortesQuery = await pool.query(
      `SELECT mes, balance_inicial, total_ingresos, total_egresos, balance_al_corte, supero_limite
       FROM cortes_mensuales
       WHERE usuario_id = $1 AND anio = $2
       ORDER BY mes ASC`,
      [targetUserId, anio]
    );

    const cortesMap = new Map();
    for (const c of cortesQuery.rows) {
      cortesMap.set(c.mes, c);
    }

    const mesesNombres = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const serieMensual = meses.map((m) => {
      const c = cortesMap.get(m);
      return {
        mes: m,
        nombre_mes: mesesNombres[m - 1],
        balance_inicial: c ? parseFloat(c.balance_inicial) : 0,
        total_ingresos: c ? parseFloat(c.total_ingresos) : 0,
        total_egresos: c ? parseFloat(c.total_egresos) : 0,
        balance_al_corte: c ? parseFloat(c.balance_al_corte) : 0,
        supero_limite: c ? c.supero_limite : false,
        cerrado: Boolean(c),
      };
    });

    return ok(res, "Resumen anual de evolución financiera obtenido exitosamente", {
      usuario_id: targetUserId,
      anio,
      meses: serieMensual,
    });
  } catch (error) {
    console.error("Error en getResumenAnual:", error);
    return fail(res, "Error al generar resumen anual", 500);
  }
};
