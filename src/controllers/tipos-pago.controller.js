import { pool } from "../db/connection.js";
import { appendFilter, buildSetClause, pagination } from "../utils/db.js";
import { fail, ok } from "../utils/response.js";

export const getTiposPago = async (req, res) => {
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
      `SELECT COUNT(*) FROM tipos_pago ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT id, descripcion, estado, created_at, updated_at
       FROM tipos_pago
       ${whereClause}
       ORDER BY descripcion ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return ok(res, "Tipos de pago recuperados exitosamente", {
      total,
      page,
      limit,
      tipos_pago: dataResult.rows,
    });
  } catch (error) {
    console.error("Error en getTiposPago:", error);
    return fail(res, "Error al obtener tipos de pago", 500);
  }
};

export const getTipoPagoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, descripcion, estado, created_at, updated_at
       FROM tipos_pago
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Tipo de pago no encontrado", 404);
    }

    return ok(res, "Tipo de pago obtenido exitosamente", { tipo_pago: result.rows[0] });
  } catch (error) {
    console.error("Error en getTipoPagoById:", error);
    return fail(res, "Error al obtener tipo de pago", 500);
  }
};

export const createTipoPago = async (req, res) => {
  try {
    const { descripcion, estado = "ACTIVO" } = req.body;

    if (!descripcion || !descripcion.trim()) {
      return fail(res, "La descripción del tipo de pago es obligatoria", 400);
    }

    const trimmedDesc = descripcion.trim();
    const existing = await pool.query(
      "SELECT id FROM tipos_pago WHERE LOWER(descripcion) = LOWER($1)",
      [trimmedDesc]
    );

    if (existing.rows.length > 0) {
      return fail(res, "Ya existe un tipo de pago con esa descripción", 409);
    }

    const result = await pool.query(
      `INSERT INTO tipos_pago (descripcion, estado)
       VALUES ($1, $2)
       RETURNING id, descripcion, estado, created_at, updated_at`,
      [trimmedDesc, estado.toUpperCase()]
    );

    return ok(res, "Tipo de pago creado exitosamente", { tipo_pago: result.rows[0] }, 201);
  } catch (error) {
    console.error("Error en createTipoPago:", error);
    return fail(res, "Error al crear tipo de pago", 500);
  }
};

export const updateTipoPago = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ["descripcion", "estado"];
    const { fields, values, setClause } = buildSetClause(req.body, allowedFields);

    if (fields.length === 0) {
      return fail(res, "No se enviaron campos válidos para actualizar", 400);
    }

    if (req.body.descripcion) {
      const existing = await pool.query(
        "SELECT id FROM tipos_pago WHERE LOWER(descripcion) = LOWER($1) AND id != $2",
        [req.body.descripcion.trim(), id]
      );
      if (existing.rows.length > 0) {
        return fail(res, "Ya existe otro tipo de pago con esa descripción", 409);
      }
    }

    const result = await pool.query(
      `UPDATE tipos_pago
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING id, descripcion, estado, created_at, updated_at`,
      [...values, id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Tipo de pago no encontrado", 404);
    }

    return ok(res, "Tipo de pago actualizado exitosamente", { tipo_pago: result.rows[0] });
  } catch (error) {
    console.error("Error en updateTipoPago:", error);
    return fail(res, "Error al actualizar tipo de pago", 500);
  }
};

export const deleteTipoPago = async (req, res) => {
  try {
    const { id } = req.params;

    const inUseTrans = await pool.query(
      "SELECT id FROM transacciones WHERE tipo_pago_id = $1 LIMIT 1",
      [id]
    );

    if (inUseTrans.rows.length > 0) {
      return fail(res, "No se puede eliminar el tipo de pago porque está siendo utilizado en transacciones", 400);
    }

    const result = await pool.query(
      "DELETE FROM tipos_pago WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Tipo de pago no encontrado", 404);
    }

    return ok(res, "Tipo de pago eliminado exitosamente", { id });
  } catch (error) {
    console.error("Error en deleteTipoPago:", error);
    return fail(res, "Error al eliminar tipo de pago", 500);
  }
};
