import { pool } from "../db/connection.js";
import { appendFilter, buildSetClause, pagination } from "../utils/db.js";
import { fail, ok } from "../utils/response.js";
import { createSystemLog } from "../utils/systemLog.js";
import { getActivePeriodDates } from "./usuarios.controller.js";

const transaccionSelect = `
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
`;

const generateFolio = async (client, dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `TRX-${year}${month}-`;

  const result = await client.query(
    "SELECT numero_transaccion FROM transacciones WHERE numero_transaccion LIKE $1 ORDER BY numero_transaccion DESC LIMIT 1",
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (result.rows.length > 0) {
    const lastNum = result.rows[0].numero_transaccion.split("-")[2];
    nextSeq = parseInt(lastNum, 10) + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
};

export const getTransacciones = async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const conditions = [];
    const values = [];

    // Si no es ADMIN, solo puede ver sus propias transacciones
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
    if (req.query.busqueda) {
      values.push(`%${req.query.busqueda}%`);
      const idx = values.length;
      conditions.push(
        `(t.numero_transaccion ILIKE $${idx} OR t.comentario ILIKE $${idx} OR ce.descripcion ILIKE $${idx} OR ci.descripcion ILIKE $${idx})`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)
       FROM transacciones t
       LEFT JOIN conceptos_egresos ce ON ce.id = t.concepto_egreso_id
       LEFT JOIN conceptos_ingresos ci ON ci.id = t.concepto_ingreso_id
       ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT ${transaccionSelect}
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
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return ok(res, "Transacciones obtenidas exitosamente", {
      total,
      page,
      limit,
      transacciones: dataResult.rows,
    });
  } catch (error) {
    console.error("Error en getTransacciones:", error);
    return fail(res, "Error al obtener transacciones", 500);
  }
};

export const getTransaccionById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT ${transaccionSelect}
       FROM transacciones t
       JOIN usuarios u ON u.id = t.usuario_id
       LEFT JOIN conceptos_egresos ce ON ce.id = t.concepto_egreso_id
       LEFT JOIN tipos_egresos te ON te.id = ce.tipo_egreso_id
       LEFT JOIN renglones_egresos re ON re.id = ce.renglon_egreso_id
       LEFT JOIN conceptos_ingresos ci ON ci.id = t.concepto_ingreso_id
       LEFT JOIN tipos_ingresos ti ON ti.id = ci.tipo_ingreso_id
       LEFT JOIN tipos_pago tp ON tp.id = t.tipo_pago_id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Transacción no encontrada", 404);
    }

    const transaccion = result.rows[0];

    // Verificar permisos
    if (req.user.role !== "ADMIN" && transaccion.usuario_id !== req.user.id) {
      return fail(res, "No tienes permiso para ver esta transacción", 403);
    }

    return ok(res, "Transacción obtenida exitosamente", { transaccion });
  } catch (error) {
    console.error("Error en getTransaccionById:", error);
    return fail(res, "Error al obtener la transacción", 500);
  }
};

export const createTransaccion = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let {
      tipo_transaccion,
      usuario_id,
      concepto_egreso_id = null,
      concepto_ingreso_id = null,
      tipo_pago_id = null,
      fecha_transaccion = new Date().toISOString().split("T")[0],
      monto,
      numero_tarjeta_credito = null,
      comentario = null,
      estado = "APLICADA",
    } = req.body;

    // Asignar usuario_id: Si no es admin o no se provee, asigna el propio
    const targetUserId = req.user.role === "ADMIN" && usuario_id ? usuario_id : req.user.id;

    if (!tipo_transaccion || !monto) {
      await client.query("ROLLBACK");
      return fail(res, "tipo_transaccion y monto son obligatorios", 400);
    }

    const upperTipo = tipo_transaccion.toUpperCase();
    if (!["INGRESO", "EGRESO"].includes(upperTipo)) {
      await client.query("ROLLBACK");
      return fail(res, "tipo_transaccion debe ser INGRESO o EGRESO", 400);
    }

    const numMonto = parseFloat(monto);
    if (isNaN(numMonto) || numMonto <= 0) {
      await client.query("ROLLBACK");
      return fail(res, "El monto debe ser un número positivo mayor que cero", 400);
    }

    if (upperTipo === "EGRESO" && !concepto_egreso_id) {
      await client.query("ROLLBACK");
      return fail(res, "concepto_egreso_id es obligatorio para transacciones de egreso", 400);
    }

    if (upperTipo === "INGRESO" && !concepto_ingreso_id) {
      await client.query("ROLLBACK");
      return fail(res, "concepto_ingreso_id es obligatorio para transacciones de ingreso", 400);
    }

    // Verificar usuario
    const userResult = await client.query(
      "SELECT id, nombre, limite_egresos, fecha_corte FROM usuarios WHERE id = $1",
      [targetUserId]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return fail(res, "Usuario asociado no encontrado", 404);
    }

    const targetUser = userResult.rows[0];

    // Verificar concepto_egreso si aplica
    if (concepto_egreso_id) {
      const ceResult = await client.query("SELECT id, tipo_pago_defecto_id FROM conceptos_egresos WHERE id = $1", [
        concepto_egreso_id,
      ]);
      if (ceResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return fail(res, "El concepto de egreso especificado no existe", 400);
      }
      if (!tipo_pago_id && ceResult.rows[0].tipo_pago_defecto_id) {
        tipo_pago_id = ceResult.rows[0].tipo_pago_defecto_id;
      }
    }

    // Verificar concepto_ingreso si aplica
    if (concepto_ingreso_id) {
      const ciResult = await client.query("SELECT id FROM conceptos_ingresos WHERE id = $1", [
        concepto_ingreso_id,
      ]);
      if (ciResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return fail(res, "El concepto de ingreso especificado no existe", 400);
      }
    }

    // Verificar tipo_pago si aplica
    if (tipo_pago_id) {
      const tpResult = await client.query("SELECT id FROM tipos_pago WHERE id = $1", [tipo_pago_id]);
      if (tpResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return fail(res, "El tipo de pago especificado no existe", 400);
      }
    }

    // Generar Folio
    const numero_transaccion = await generateFolio(client, fecha_transaccion);

    // Insertar transacción
    const insertResult = await client.query(
      `INSERT INTO transacciones (
        numero_transaccion, tipo_transaccion, usuario_id, concepto_egreso_id,
        concepto_ingreso_id, tipo_pago_id, fecha_transaccion, monto,
        numero_tarjeta_credito, comentario, estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        numero_transaccion,
        upperTipo,
        targetUserId,
        concepto_egreso_id,
        concepto_ingreso_id,
        tipo_pago_id,
        fecha_transaccion,
        numMonto,
        numero_tarjeta_credito,
        comentario,
        estado.toUpperCase(),
      ]
    );

    const transaccionId = insertResult.rows[0].id;

    // REGLA 12: Validación y Alerta de Límite de Egresos
    let warning = null;
    if (upperTipo === "EGRESO" && estado.toUpperCase() === "APLICADA") {
      const limiteEgresos = parseFloat(targetUser.limite_egresos) || 0;
      if (limiteEgresos > 0) {
        const period = getActivePeriodDates(targetUser.fecha_corte, new Date(fecha_transaccion));

        const expSum = await client.query(
          `SELECT COALESCE(SUM(monto), 0) AS total_egresos_periodo
           FROM transacciones
           WHERE usuario_id = $1
             AND tipo_transaccion = 'EGRESO'
             AND estado = 'APLICADA'
             AND fecha_transaccion >= $2
             AND fecha_transaccion <= $3`,
          [targetUserId, period.startDate, period.endDate]
        );

        const totalEgresosPeriodo = parseFloat(expSum.rows[0].total_egresos_periodo) || 0;

        if (totalEgresosPeriodo > limiteEgresos) {
          const exceso = totalEgresosPeriodo - limiteEgresos;
          const porcentaje = parseFloat(((totalEgresosPeriodo / limiteEgresos) * 100).toFixed(2));
          warning = {
            supero_limite: true,
            limite_egresos: limiteEgresos,
            total_egresos_periodo: totalEgresosPeriodo,
            exceso,
            porcentaje_consumido: porcentaje,
            mensaje: `Alerta: El egreso registrado ha superado el límite mensual establecido de RD$ ${limiteEgresos.toLocaleString(
              "es-DO",
              { minimumFractionDigits: 2 }
            )} por RD$ ${exceso.toLocaleString("es-DO", { minimumFractionDigits: 2 })} (${porcentaje}% consumido).`,
          };
        }
      }
    }

    await client.query("COMMIT");

    // Obtener la transacción completa creada con joins
    const fullResult = await pool.query(
      `SELECT ${transaccionSelect}
       FROM transacciones t
       JOIN usuarios u ON u.id = t.usuario_id
       LEFT JOIN conceptos_egresos ce ON ce.id = t.concepto_egreso_id
       LEFT JOIN tipos_egresos te ON te.id = ce.tipo_egreso_id
       LEFT JOIN renglones_egresos re ON re.id = ce.renglon_egreso_id
       LEFT JOIN conceptos_ingresos ci ON ci.id = t.concepto_ingreso_id
       LEFT JOIN tipos_ingresos ti ON ti.id = ci.tipo_ingreso_id
       LEFT JOIN tipos_pago tp ON tp.id = t.tipo_pago_id
       WHERE t.id = $1`,
      [transaccionId]
    );

    await createSystemLog({
      actorId: req.user.id,
      targetUserId,
      action: "CREATE_TRANSACCION",
      entityType: "TRANSACCION",
      entityId: transaccionId,
      newValues: { numero_transaccion, tipo_transaccion: upperTipo, monto: numMonto },
      req,
    });

    const responseData = { transaccion: fullResult.rows[0] };
    if (warning) {
      responseData.warning = warning;
    }

    return ok(res, "Transacción registrada exitosamente", responseData, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error en createTransaccion:", error);
    return fail(res, "Error al crear transacción", 500);
  } finally {
    client.release();
  }
};

export const updateTransaccion = async (req, res) => {
  try {
    const { id } = req.params;

    const existingResult = await pool.query("SELECT * FROM transacciones WHERE id = $1", [id]);
    if (existingResult.rows.length === 0) {
      return fail(res, "Transacción no encontrada", 404);
    }

    const transaccion = existingResult.rows[0];
    if (req.user.role !== "ADMIN" && transaccion.usuario_id !== req.user.id) {
      return fail(res, "No tienes permiso para modificar esta transacción", 403);
    }

    if (transaccion.estado === "ANULADA") {
      return fail(res, "No se puede modificar una transacción que ya ha sido anulada", 400);
    }

    const allowedFields = [
      "monto",
      "tipo_pago_id",
      "numero_tarjeta_credito",
      "comentario",
      "fecha_transaccion",
      "estado",
    ];

    if (transaccion.tipo_transaccion === "EGRESO") {
      allowedFields.push("concepto_egreso_id");
    } else {
      allowedFields.push("concepto_ingreso_id");
    }

    const { fields, values, setClause } = buildSetClause(req.body, allowedFields);

    if (fields.length === 0) {
      return fail(res, "No se enviaron campos válidos para actualizar", 400);
    }

    await pool.query(
      `UPDATE transacciones
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${values.length + 1}`,
      [...values, id]
    );

    const fullResult = await pool.query(
      `SELECT ${transaccionSelect}
       FROM transacciones t
       JOIN usuarios u ON u.id = t.usuario_id
       LEFT JOIN conceptos_egresos ce ON ce.id = t.concepto_egreso_id
       LEFT JOIN tipos_egresos te ON te.id = ce.tipo_egreso_id
       LEFT JOIN renglones_egresos re ON re.id = ce.renglon_egreso_id
       LEFT JOIN conceptos_ingresos ci ON ci.id = t.concepto_ingreso_id
       LEFT JOIN tipos_ingresos ti ON ti.id = ci.tipo_ingreso_id
       LEFT JOIN tipos_pago tp ON tp.id = t.tipo_pago_id
       WHERE t.id = $1`,
      [id]
    );

    await createSystemLog({
      actorId: req.user.id,
      targetUserId: transaccion.usuario_id,
      action: "UPDATE_TRANSACCION",
      entityType: "TRANSACCION",
      entityId: id,
      oldValues: transaccion,
      newValues: req.body,
      req,
    });

    return ok(res, "Transacción actualizada exitosamente", { transaccion: fullResult.rows[0] });
  } catch (error) {
    console.error("Error en updateTransaccion:", error);
    return fail(res, "Error al actualizar la transacción", 500);
  }
};

export const anularTransaccion = async (req, res) => {
  try {
    const { id } = req.params;

    const existingResult = await pool.query("SELECT * FROM transacciones WHERE id = $1", [id]);
    if (existingResult.rows.length === 0) {
      return fail(res, "Transacción no encontrada", 404);
    }

    const transaccion = existingResult.rows[0];
    if (req.user.role !== "ADMIN" && transaccion.usuario_id !== req.user.id) {
      return fail(res, "No tienes permiso para anular esta transacción", 403);
    }

    if (transaccion.estado === "ANULADA") {
      return fail(res, "La transacción ya se encuentra anulada", 400);
    }

    await pool.query(
      "UPDATE transacciones SET estado = 'ANULADA', updated_at = NOW() WHERE id = $1",
      [id]
    );

    await createSystemLog({
      actorId: req.user.id,
      targetUserId: transaccion.usuario_id,
      action: "ANULAR_TRANSACCION",
      entityType: "TRANSACCION",
      entityId: id,
      reason: req.body.motivo || "Anulación solicitada por el usuario",
      req,
    });

    return ok(res, "Transacción anulada exitosamente", { id, estado: "ANULADA" });
  } catch (error) {
    console.error("Error en anularTransaccion:", error);
    return fail(res, "Error al anular la transacción", 500);
  }
};

export const deleteTransaccion = async (req, res) => {
  try {
    const { id } = req.params;

    const existingResult = await pool.query("SELECT * FROM transacciones WHERE id = $1", [id]);
    if (existingResult.rows.length === 0) {
      return fail(res, "Transacción no encontrada", 404);
    }

    await pool.query("DELETE FROM transacciones WHERE id = $1", [id]);

    await createSystemLog({
      actorId: req.user.id,
      targetUserId: existingResult.rows[0].usuario_id,
      action: "DELETE_TRANSACCION",
      entityType: "TRANSACCION",
      entityId: id,
      oldValues: existingResult.rows[0],
      req,
    });

    return ok(res, "Transacción eliminada del sistema exitosamente", { id });
  } catch (error) {
    console.error("Error en deleteTransaccion:", error);
    return fail(res, "Error al eliminar transacción", 500);
  }
};
