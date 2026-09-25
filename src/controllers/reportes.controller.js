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

    const resumenData = {
      total_cortes: result.rows.length,
      total_periodos_cerrados: result.rows.length,
      total_ingresos: totalIngresos,
      total_egresos: totalEgresos,
      balance_neto_acumulado: totalIngresos - totalEgresos,
      balance_neto: totalIngresos - totalEgresos,
      cortes_superaron_limite: superoLimiteCount,
      meses_supero_limite: superoLimiteCount,
    };

    return ok(res, "Reporte consolidado de cortes obtenido exitosamente", {
      anio,
      resumen: resumenData,
      totales_consolidados: resumenData,
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

    const userQuery = await pool.query(`SELECT limite_egresos FROM usuarios WHERE id = $1`, [targetUserId]);
    const globalLimit = userQuery.rows[0]?.limite_egresos ? parseFloat(userQuery.rows[0].limite_egresos) : 0;

    const cortesQuery = await pool.query(
      `SELECT
        c.id, c.anio, c.mes, c.fecha_corte, c.balance_inicial, c.total_ingresos, c.total_egresos,
        c.limite_egresos_periodo, c.supero_limite,
        CASE
          WHEN c.limite_egresos_periodo > 0 THEN ROUND((c.total_egresos / c.limite_egresos_periodo) * 100, 2)
          ELSE 0
        END AS porcentaje_consumido
       FROM cortes_mensuales c
       WHERE (c.usuario_id = $1 OR $2 = 'ADMIN')
       ORDER BY c.anio DESC, c.mes DESC`,
      [targetUserId, req.user.role]
    );

    const historial = cortesQuery.rows.map((row) => ({
      id: row.id,
      anio: row.anio,
      mes: row.mes,
      fecha_corte: row.fecha_corte,
      limite_egresos_periodo: parseFloat(row.limite_egresos_periodo || globalLimit || 0),
      total_egresos: parseFloat(row.total_egresos || 0),
      porcentaje_consumido: parseFloat(row.porcentaje_consumido || 0),
      supero_limite: Boolean(row.supero_limite),
    }));

    const totalEvaluaciones = historial.length;
    const periodosExcedidos = historial.filter((h) => h.supero_limite).length;
    const periodosEnRegla = totalEvaluaciones - periodosExcedidos;

    const estadisticas = {
      total_evaluaciones: totalEvaluaciones,
      periodos_en_regla: periodosEnRegla,
      periodos_excedidos: periodosExcedidos,
    };

    return ok(res, "Reporte de cumplimiento de límites obtenido exitosamente", {
      estadisticas,
      historial,
      total_usuarios_con_limite: totalEvaluaciones > 0 ? 1 : 0,
      usuarios: [
        {
          usuario_id: targetUserId,
          limite_egresos: globalLimit,
          total_cortes_evaluados: totalEvaluaciones,
          cortes_con_exceso: periodosExcedidos,
        },
      ],
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

    // Cortes cerrados del año
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

    // Transacciones del año agrupadas por mes y tipo
    const trxQuery = await pool.query(
      `SELECT
        EXTRACT(MONTH FROM fecha_transaccion)::INTEGER AS mes,
        tipo_transaccion,
        COALESCE(SUM(monto), 0) AS total
       FROM transacciones
       WHERE usuario_id = $1
         AND EXTRACT(YEAR FROM fecha_transaccion)::INTEGER = $2
         AND estado = 'APLICADA'
       GROUP BY EXTRACT(MONTH FROM fecha_transaccion)::INTEGER, tipo_transaccion`,
      [targetUserId, anio]
    );

    const trxMap = new Map();
    for (const r of trxQuery.rows) {
      const key = `${r.mes}_${r.tipo_transaccion}`;
      trxMap.set(key, parseFloat(r.total));
    }

    const mesesNombres = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const serieMensual = meses.map((m) => {
      const c = cortesMap.get(m);
      const ingTrx = trxMap.get(`${m}_INGRESO`) || 0;
      const egrTrx = trxMap.get(`${m}_EGRESO`) || 0;

      const totalIng = c ? parseFloat(c.total_ingresos) : ingTrx;
      const totalEgr = c ? parseFloat(c.total_egresos) : egrTrx;
      const balNeto = c ? parseFloat(c.balance_al_corte) : totalIng - totalEgr;

      return {
        mes: m,
        nombre_mes: mesesNombres[m - 1],
        balance_inicial: c ? parseFloat(c.balance_inicial) : 0,
        total_ingresos: totalIng,
        ingresos: totalIng,
        total_egresos: totalEgr,
        egresos: totalEgr,
        balance_al_corte: balNeto,
        balance: balNeto,
        supero_limite: c ? Boolean(c.supero_limite) : false,
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
