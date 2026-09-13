import { pool } from "../db/connection.js";

export const createSystemLog = async ({
  client = pool,
  actorId = null,
  targetUserId = null,
  action,
  entityType = null,
  entityId = null,
  oldValues = null,
  newValues = null,
  reason = null,
  req = null,
}) => {
  try {
    await client.query(
      `INSERT INTO system_logs (
        actor_id, target_user_id, action, entity_type, entity_id,
        old_values, new_values, reason, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        actorId,
        targetUserId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        reason,
        req?.ip || req?.headers?.["x-forwarded-for"] || null,
        req?.headers?.["user-agent"] || null,
      ]
    );
  } catch (error) {
    console.error("Error al registrar system_log:", error.message);
  }
};
