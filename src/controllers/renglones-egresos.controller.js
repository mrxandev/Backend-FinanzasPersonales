import { pool } from "../db/connection.js";
import { appendFilter, buildSetClause, pagination } from "../utils/db.js";
import { fail, ok } from "../utils/response.js";

export const getRenglonesEgresos = async (req, res) => {
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
      `SELECT COUNT(*) FROM renglones_egresos ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT id, descripcion, estado, created_at, updated_at
       FROM renglones_egresos
       ${whereClause}
       ORDER BY descripcion ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return ok(res, "Renglones de egresos recuperados exitosamente", {
      total,
      page,
      limit,
      renglones_egresos: dataResult.rows,
    });
  } catch (error) {
    console.error("Error en getRenglonesEgresos:", error);
    return fail(res, "Error al obtener renglones de egresos", 500);
  }
};

export const getRenglonEgresoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, descripcion, estado, created_at, updated_at
       FROM renglones_egresos
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Renglón de egreso no encontrado", 404);
    }

    return ok(res, "Renglón de egreso obtenido exitosamente", { renglon_egreso: result.rows[0] });
  } catch (error) {
    console.error("Error en getRenglonEgresoById:", error);
    return fail(res, "Error al obtener renglón de egreso", 500);
  }
};

export const createRenglonEgreso = async (req, res) => {
  try {
    const { descripcion, estado = "ACTIVO" } = req.body;

    if (!descripcion || !descripcion.trim()) {
      return fail(res, "La descripción del renglón es obligatoria", 400);
    }

    const trimmedDesc = descripcion.trim();
    const existing = await pool.query(
      "SELECT id FROM renglones_egresos WHERE LOWER(descripcion) = LOWER($1)",
      [trimmedDesc]
    );

    if (existing.rows.length > 0) {
      return fail(res, "Ya existe un renglón con esa descripción", 409);
    }

    const result = await pool.query(
      `INSERT INTO renglones_egresos (descripcion, estado)
       VALUES ($1, $2)
       RETURNING id, descripcion, estado, created_at, updated_at`,
      [trimmedDesc, estado.toUpperCase()]
    );

    return ok(res, "Renglón de egreso creado exitosamente", { renglon_egreso: result.rows[0] }, 201);
  } catch (error) {
    console.error("Error en createRenglonEgreso:", error);
    return fail(res, "Error al crear renglón de egreso", 500);
  }
};

export const updateRenglonEgreso = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ["descripcion", "estado"];
    const { fields, values, setClause } = buildSetClause(req.body, allowedFields);

    if (fields.length === 0) {
      return fail(res, "No se enviaron campos válidos para actualizar", 400);
    }

    if (req.body.descripcion) {
      const existing = await pool.query(
        "SELECT id FROM renglones_egresos WHERE LOWER(descripcion) = LOWER($1) AND id != $2",
        [req.body.descripcion.trim(), id]
      );
      if (existing.rows.length > 0) {
        return fail(res, "Ya existe otro renglón con esa descripción", 409);
      }
    }

    const result = await pool.query(
      `UPDATE renglones_egresos
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING id, descripcion, estado, created_at, updated_at`,
      [...values, id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Renglón de egreso no encontrado", 404);
    }

    return ok(res, "Renglón de egreso actualizado exitosamente", { renglon_egreso: result.rows[0] });
  } catch (error) {
    console.error("Error en updateRenglonEgreso:", error);
    return fail(res, "Error al actualizar renglón de egreso", 500);
  }
};

export const deleteRenglonEgreso = async (req, res) => {
  try {
    const { id } = req.params;

    const inUse = await pool.query(
      "SELECT id FROM conceptos_egresos WHERE renglon_egreso_id = $1 LIMIT 1",
      [id]
    );

    if (inUse.rows.length > 0) {
      return fail(res, "No se puede eliminar el renglón porque tiene conceptos asociados", 400);
    }

    const result = await pool.query(
      "DELETE FROM renglones_egresos WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Renglón de egreso no encontrado", 404);
    }

    return ok(res, "Renglón de egreso eliminado exitosamente", { id });
  } catch (error) {
    console.error("Error en deleteRenglonEgreso:", error);
    return fail(res, "Error al eliminar renglón de egreso", 500);
  }
};
