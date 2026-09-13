import { pool } from "../db/connection.js";
import { appendFilter, buildSetClause, pagination } from "../utils/db.js";
import { fail, ok } from "../utils/response.js";

export const getTiposIngresos = async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const conditions = [];
    const values = [];

    if (req.query.estado) {
      appendFilter(conditions, values, "estado", req.query.estado);
    }
    if (req.query.busqueda) {
      appendFilter(conditions, values, "descripcion", req.query.busqueda, "ILIKE");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM tipos_ingresos ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT id, descripcion, estado, created_at, updated_at
       FROM tipos_ingresos
       ${whereClause}
       ORDER BY descripcion ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return ok(res, "Tipos de ingresos recuperados exitosamente", {
      total,
      page,
      limit,
      tipos_ingresos: dataResult.rows,
    });
  } catch (error) {
    console.error("Error en getTiposIngresos:", error);
    return fail(res, "Error al obtener tipos de ingresos", 500);
  }
};

export const getTipoIngresoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, descripcion, estado, created_at, updated_at
       FROM tipos_ingresos
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Tipo de ingreso no encontrado", 404);
    }

    return ok(res, "Tipo de ingreso obtenido exitosamente", { tipo_ingreso: result.rows[0] });
  } catch (error) {
    console.error("Error en getTipoIngresoById:", error);
    return fail(res, "Error al obtener tipo de ingreso", 500);
  }
};

export const createTipoIngreso = async (req, res) => {
  try {
    const { descripcion, estado = "ACTIVO" } = req.body;

    if (!descripcion || !descripcion.trim()) {
      return fail(res, "La descripción del tipo de ingreso es obligatoria", 400);
    }

    const trimmedDesc = descripcion.trim();
    const existing = await pool.query(
      "SELECT id FROM tipos_ingresos WHERE LOWER(descripcion) = LOWER($1)",
      [trimmedDesc]
    );

    if (existing.rows.length > 0) {
      return fail(res, "Ya existe un tipo de ingreso con esa descripción", 409);
    }

    const result = await pool.query(
      `INSERT INTO tipos_ingresos (descripcion, estado)
       VALUES ($1, $2)
       RETURNING id, descripcion, estado, created_at, updated_at`,
      [trimmedDesc, estado.toUpperCase()]
    );

    return ok(res, "Tipo de ingreso creado exitosamente", { tipo_ingreso: result.rows[0] }, 201);
  } catch (error) {
    console.error("Error en createTipoIngreso:", error);
    return fail(res, "Error al crear tipo de ingreso", 500);
  }
};

export const updateTipoIngreso = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ["descripcion", "estado"];
    const { fields, values, setClause } = buildSetClause(req.body, allowedFields);

    if (fields.length === 0) {
      return fail(res, "No se enviaron campos válidos para actualizar", 400);
    }

    if (req.body.descripcion) {
      const existing = await pool.query(
        "SELECT id FROM tipos_ingresos WHERE LOWER(descripcion) = LOWER($1) AND id != $2",
        [req.body.descripcion.trim(), id]
      );
      if (existing.rows.length > 0) {
        return fail(res, "Ya existe otro tipo de ingreso con esa descripción", 409);
      }
    }

    const result = await pool.query(
      `UPDATE tipos_ingresos
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING id, descripcion, estado, created_at, updated_at`,
      [...values, id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Tipo de ingreso no encontrado", 404);
    }

    return ok(res, "Tipo de ingreso actualizado exitosamente", { tipo_ingreso: result.rows[0] });
  } catch (error) {
    console.error("Error en updateTipoIngreso:", error);
    return fail(res, "Error al actualizar tipo de ingreso", 500);
  }
};

export const deleteTipoIngreso = async (req, res) => {
  try {
    const { id } = req.params;

    const inUse = await pool.query(
      "SELECT id FROM conceptos_ingresos WHERE tipo_ingreso_id = $1 LIMIT 1",
      [id]
    );

    if (inUse.rows.length > 0) {
      return fail(res, "No se puede eliminar el tipo de ingreso porque tiene conceptos asociados", 400);
    }

    const result = await pool.query(
      "DELETE FROM tipos_ingresos WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Tipo de ingreso no encontrado", 404);
    }

    return ok(res, "Tipo de ingreso eliminado exitosamente", { id });
  } catch (error) {
    console.error("Error en deleteTipoIngreso:", error);
    return fail(res, "Error al eliminar tipo de ingreso", 500);
  }
};
