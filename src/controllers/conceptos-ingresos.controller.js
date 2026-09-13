import { pool } from "../db/connection.js";
import { appendFilter, buildSetClause, pagination } from "../utils/db.js";
import { fail, ok } from "../utils/response.js";

const conceptoIngresoSelect = `
  ci.id,
  ci.tipo_ingreso_id,
  ti.descripcion AS tipo_ingreso_descripcion,
  ci.descripcion,
  ci.institucion,
  ci.estado,
  ci.created_at,
  ci.updated_at
`;

export const getConceptosIngresos = async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const conditions = [];
    const values = [];

    if (req.query.tipo_ingreso_id) {
      appendFilter(conditions, values, "ci.tipo_ingreso_id", req.query.tipo_ingreso_id);
    }
    if (req.query.estado) {
      appendFilter(conditions, values, "ci.estado", req.query.estado);
    }
    if (req.query.busqueda) {
      values.push(`%${req.query.busqueda}%`);
      const idx = values.length;
      conditions.push(`(ci.descripcion ILIKE $${idx} OR ci.institucion ILIKE $${idx})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM conceptos_ingresos ci ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT ${conceptoIngresoSelect}
       FROM conceptos_ingresos ci
       JOIN tipos_ingresos ti ON ti.id = ci.tipo_ingreso_id
       ${whereClause}
       ORDER BY ci.descripcion ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return ok(res, "Conceptos de ingresos obtenidos exitosamente", {
      total,
      page,
      limit,
      conceptos_ingresos: dataResult.rows,
    });
  } catch (error) {
    console.error("Error en getConceptosIngresos:", error);
    return fail(res, "Error al obtener conceptos de ingresos", 500);
  }
};

export const getConceptoIngresoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT ${conceptoIngresoSelect}
       FROM conceptos_ingresos ci
       JOIN tipos_ingresos ti ON ti.id = ci.tipo_ingreso_id
       WHERE ci.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Concepto de ingreso no encontrado", 404);
    }

    return ok(res, "Concepto de ingreso obtenido exitosamente", { concepto_ingreso: result.rows[0] });
  } catch (error) {
    console.error("Error en getConceptoIngresoById:", error);
    return fail(res, "Error al obtener concepto de ingreso", 500);
  }
};

export const createConceptoIngreso = async (req, res) => {
  try {
    const {
      tipo_ingreso_id,
      descripcion,
      institucion = null,
      estado = "ACTIVO",
    } = req.body;

    if (!tipo_ingreso_id || !descripcion || !descripcion.trim()) {
      return fail(res, "tipo_ingreso_id y descripcion son obligatorios", 400);
    }

    const checkTi = await pool.query("SELECT id FROM tipos_ingresos WHERE id = $1", [tipo_ingreso_id]);
    if (checkTi.rows.length === 0) {
      return fail(res, "El tipo de ingreso especificado no existe", 400);
    }

    const insertResult = await pool.query(
      `INSERT INTO conceptos_ingresos (tipo_ingreso_id, descripcion, institucion, estado)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [tipo_ingreso_id, descripcion.trim(), institucion ? institucion.trim() : null, estado.toUpperCase()]
    );

    const fullResult = await pool.query(
      `SELECT ${conceptoIngresoSelect}
       FROM conceptos_ingresos ci
       JOIN tipos_ingresos ti ON ti.id = ci.tipo_ingreso_id
       WHERE ci.id = $1`,
      [insertResult.rows[0].id]
    );

    return ok(res, "Concepto de ingreso creado exitosamente", { concepto_ingreso: fullResult.rows[0] }, 201);
  } catch (error) {
    console.error("Error en createConceptoIngreso:", error);
    return fail(res, "Error al crear concepto de ingreso", 500);
  }
};

export const updateConceptoIngreso = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ["tipo_ingreso_id", "descripcion", "institucion", "estado"];
    const { fields, values, setClause } = buildSetClause(req.body, allowedFields);

    if (fields.length === 0) {
      return fail(res, "No se enviaron campos válidos para actualizar", 400);
    }

    if (req.body.tipo_ingreso_id) {
      const checkTi = await pool.query("SELECT id FROM tipos_ingresos WHERE id = $1", [req.body.tipo_ingreso_id]);
      if (checkTi.rows.length === 0) {
        return fail(res, "El tipo de ingreso especificado no existe", 400);
      }
    }

    const updateResult = await pool.query(
      `UPDATE conceptos_ingresos
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING id`,
      [...values, id]
    );

    if (updateResult.rows.length === 0) {
      return fail(res, "Concepto de ingreso no encontrado", 404);
    }

    const fullResult = await pool.query(
      `SELECT ${conceptoIngresoSelect}
       FROM conceptos_ingresos ci
       JOIN tipos_ingresos ti ON ti.id = ci.tipo_ingreso_id
       WHERE ci.id = $1`,
      [id]
    );

    return ok(res, "Concepto de ingreso actualizado exitosamente", { concepto_ingreso: fullResult.rows[0] });
  } catch (error) {
    console.error("Error en updateConceptoIngreso:", error);
    return fail(res, "Error al actualizar concepto de ingreso", 500);
  }
};

export const deleteConceptoIngreso = async (req, res) => {
  try {
    const { id } = req.params;

    const inUse = await pool.query(
      "SELECT id FROM transacciones WHERE concepto_ingreso_id = $1 LIMIT 1",
      [id]
    );

    if (inUse.rows.length > 0) {
      return fail(res, "No se puede eliminar el concepto de ingreso porque tiene transacciones asociadas", 400);
    }

    const result = await pool.query(
      "DELETE FROM conceptos_ingresos WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Concepto de ingreso no encontrado", 404);
    }

    return ok(res, "Concepto de ingreso eliminado exitosamente", { id });
  } catch (error) {
    console.error("Error en deleteConceptoIngreso:", error);
    return fail(res, "Error al eliminar concepto de ingreso", 500);
  }
};
