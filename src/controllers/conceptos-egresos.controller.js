import { pool } from "../db/connection.js";
import { appendFilter, buildSetClause, pagination } from "../utils/db.js";
import { fail, ok } from "../utils/response.js";

const conceptoEgresoSelect = `
  ce.id,
  ce.tipo_egreso_id,
  te.descripcion AS tipo_egreso_descripcion,
  ce.renglon_egreso_id,
  re.descripcion AS renglon_egreso_descripcion,
  ce.tipo_pago_defecto_id,
  tp.descripcion AS tipo_pago_defecto_descripcion,
  ce.descripcion,
  ce.estado,
  ce.created_at,
  ce.updated_at
`;

export const getConceptosEgresos = async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const conditions = [];
    const values = [];

    if (req.query.tipo_egreso_id) {
      appendFilter(conditions, values, "ce.tipo_egreso_id", req.query.tipo_egreso_id);
    }
    if (req.query.renglon_egreso_id) {
      appendFilter(conditions, values, "ce.renglon_egreso_id", req.query.renglon_egreso_id);
    }
    if (req.query.estado) {
      appendFilter(conditions, values, "ce.estado", req.query.estado);
    }
    if (req.query.busqueda) {
      appendFilter(conditions, values, "ce.descripcion", req.query.busqueda, "ILIKE");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM conceptos_egresos ce ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT ${conceptoEgresoSelect}
       FROM conceptos_egresos ce
       JOIN tipos_egresos te ON te.id = ce.tipo_egreso_id
       JOIN renglones_egresos re ON re.id = ce.renglon_egreso_id
       LEFT JOIN tipos_pago tp ON tp.id = ce.tipo_pago_defecto_id
       ${whereClause}
       ORDER BY ce.descripcion ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return ok(res, "Conceptos de egresos obtenidos exitosamente", {
      total,
      page,
      limit,
      conceptos_egresos: dataResult.rows,
    });
  } catch (error) {
    console.error("Error en getConceptosEgresos:", error);
    return fail(res, "Error al obtener conceptos de egresos", 500);
  }
};

export const getConceptoEgresoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT ${conceptoEgresoSelect}
       FROM conceptos_egresos ce
       JOIN tipos_egresos te ON te.id = ce.tipo_egreso_id
       JOIN renglones_egresos re ON re.id = ce.renglon_egreso_id
       LEFT JOIN tipos_pago tp ON tp.id = ce.tipo_pago_defecto_id
       WHERE ce.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Concepto de egreso no encontrado", 404);
    }

    return ok(res, "Concepto de egreso obtenido exitosamente", { concepto_egreso: result.rows[0] });
  } catch (error) {
    console.error("Error en getConceptoEgresoById:", error);
    return fail(res, "Error al obtener concepto de egreso", 500);
  }
};

export const createConceptoEgreso = async (req, res) => {
  try {
    const {
      tipo_egreso_id,
      renglon_egreso_id,
      tipo_pago_defecto_id = null,
      descripcion,
      estado = "ACTIVO",
    } = req.body;

    if (!tipo_egreso_id || !renglon_egreso_id || !descripcion || !descripcion.trim()) {
      return fail(
        res,
        "tipo_egreso_id, renglon_egreso_id y descripcion son campos obligatorios",
        400
      );
    }

    // Validar tipo_egreso
    const checkTe = await pool.query("SELECT id FROM tipos_egresos WHERE id = $1", [tipo_egreso_id]);
    if (checkTe.rows.length === 0) {
      return fail(res, "El tipo de egreso especificado no existe", 400);
    }

    // Validar renglon_egreso
    const checkRe = await pool.query("SELECT id FROM renglones_egresos WHERE id = $1", [renglon_egreso_id]);
    if (checkRe.rows.length === 0) {
      return fail(res, "El renglón de egreso especificado no existe", 400);
    }

    // Validar tipo_pago_defecto si se envía
    if (tipo_pago_defecto_id) {
      const checkTp = await pool.query("SELECT id FROM tipos_pago WHERE id = $1", [tipo_pago_defecto_id]);
      if (checkTp.rows.length === 0) {
        return fail(res, "El tipo de pago por defecto especificado no existe", 400);
      }
    }

    const insertResult = await pool.query(
      `INSERT INTO conceptos_egresos (tipo_egreso_id, renglon_egreso_id, tipo_pago_defecto_id, descripcion, estado)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tipo_egreso_id, renglon_egreso_id, tipo_pago_defecto_id || null, descripcion.trim(), estado.toUpperCase()]
    );

    const fullResult = await pool.query(
      `SELECT ${conceptoEgresoSelect}
       FROM conceptos_egresos ce
       JOIN tipos_egresos te ON te.id = ce.tipo_egreso_id
       JOIN renglones_egresos re ON re.id = ce.renglon_egreso_id
       LEFT JOIN tipos_pago tp ON tp.id = ce.tipo_pago_defecto_id
       WHERE ce.id = $1`,
      [insertResult.rows[0].id]
    );

    return ok(res, "Concepto de egreso creado exitosamente", { concepto_egreso: fullResult.rows[0] }, 201);
  } catch (error) {
    console.error("Error en createConceptoEgreso:", error);
    return fail(res, "Error al crear concepto de egreso", 500);
  }
};

export const updateConceptoEgreso = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ["tipo_egreso_id", "renglon_egreso_id", "tipo_pago_defecto_id", "descripcion", "estado"];
    const { fields, values, setClause } = buildSetClause(req.body, allowedFields);

    if (fields.length === 0) {
      return fail(res, "No se enviaron campos válidos para actualizar", 400);
    }

    if (req.body.tipo_egreso_id) {
      const checkTe = await pool.query("SELECT id FROM tipos_egresos WHERE id = $1", [req.body.tipo_egreso_id]);
      if (checkTe.rows.length === 0) {
        return fail(res, "El tipo de egreso especificado no existe", 400);
      }
    }

    if (req.body.renglon_egreso_id) {
      const checkRe = await pool.query("SELECT id FROM renglones_egresos WHERE id = $1", [req.body.renglon_egreso_id]);
      if (checkRe.rows.length === 0) {
        return fail(res, "El renglón de egreso especificado no existe", 400);
      }
    }

    if (req.body.tipo_pago_defecto_id) {
      const checkTp = await pool.query("SELECT id FROM tipos_pago WHERE id = $1", [req.body.tipo_pago_defecto_id]);
      if (checkTp.rows.length === 0) {
        return fail(res, "El tipo de pago por defecto especificado no existe", 400);
      }
    }

    const updateResult = await pool.query(
      `UPDATE conceptos_egresos
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING id`,
      [...values, id]
    );

    if (updateResult.rows.length === 0) {
      return fail(res, "Concepto de egreso no encontrado", 404);
    }

    const fullResult = await pool.query(
      `SELECT ${conceptoEgresoSelect}
       FROM conceptos_egresos ce
       JOIN tipos_egresos te ON te.id = ce.tipo_egreso_id
       JOIN renglones_egresos re ON re.id = ce.renglon_egreso_id
       LEFT JOIN tipos_pago tp ON tp.id = ce.tipo_pago_defecto_id
       WHERE ce.id = $1`,
      [id]
    );

    return ok(res, "Concepto de egreso actualizado exitosamente", { concepto_egreso: fullResult.rows[0] });
  } catch (error) {
    console.error("Error en updateConceptoEgreso:", error);
    return fail(res, "Error al actualizar concepto de egreso", 500);
  }
};

export const deleteConceptoEgreso = async (req, res) => {
  try {
    const { id } = req.params;

    const inUse = await pool.query(
      "SELECT id FROM transacciones WHERE concepto_egreso_id = $1 LIMIT 1",
      [id]
    );

    if (inUse.rows.length > 0) {
      return fail(res, "No se puede eliminar el concepto de egreso porque tiene transacciones asociadas", 400);
    }

    const result = await pool.query(
      "DELETE FROM conceptos_egresos WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Concepto de egreso no encontrado", 404);
    }

    return ok(res, "Concepto de egreso eliminado exitosamente", { id });
  } catch (error) {
    console.error("Error en deleteConceptoEgreso:", error);
    return fail(res, "Error al eliminar concepto de egreso", 500);
  }
};
