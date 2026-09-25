import { getActivePeriodDates } from "../controllers/usuarios.controller.js";

/**
 * Valida una cédula dominicana de 11 dígitos utilizando el algoritmo Módulo 10 (Luhn).
 * @param {string} cedula 
 * @returns {boolean}
 */
export const isValidDominicanCedula = (cedula) => {
  const clean = String(cedula || "").replace(/\D/g, "");
  if (clean.length !== 11) return false;

  // Rechazar repeticiones obvias de un mismo dígito salvo 00000000000 si se quisiera ignorar, pero en general es inválido
  if (/^(\d)\1{10}$/.test(clean)) return false;

  const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    let product = parseInt(clean[i], 10) * weights[i];
    if (product >= 10) {
      product = Math.floor(product / 10) + (product % 10);
    }
    sum += product;
  }

  const verifier = (10 - (sum % 10)) % 10;
  return verifier === parseInt(clean[10], 10);
};

/**
 * Valida un RNC dominicano de 9 dígitos.
 * @param {string} rnc 
 * @returns {boolean}
 */
export const isValidRNC = (rnc) => {
  const clean = String(rnc || "").replace(/\D/g, "");
  if (clean.length !== 9) return false;

  if (/^(\d)\1{8}$/.test(clean)) return false;

  const weights = [7, 9, 8, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    sum += parseInt(clean[i], 10) * weights[i];
  }

  const remainder = sum % 11;
  let verifier = 0;
  if (remainder === 0) verifier = 2;
  else if (remainder === 1) verifier = 1;
  else verifier = 11 - remainder;

  return verifier === parseInt(clean[8], 10);
};

/**
 * Verifica si la fecha dada corresponde a un periodo mensual cuyo corte ya ha sido procesado (estado = 'CERRADO').
 * @param {object} clientOrPool - Cliente de pg o pool
 * @param {string} usuarioId 
 * @param {string|Date} fechaTransaccion 
 * @returns {Promise<boolean>}
 */
export const checkClosedPeriod = async (clientOrPool, usuarioId, fechaTransaccion) => {
  try {
    const userRes = await clientOrPool.query(
      "SELECT fecha_corte FROM usuarios WHERE id = $1",
      [usuarioId]
    );

    if (userRes.rows.length === 0) return false;

    const fechaCorteDay = userRes.rows[0].fecha_corte || 1;
    
    // Normalizar fecha
    const strDate = typeof fechaTransaccion === "string" ? fechaTransaccion.split("T")[0] : fechaTransaccion.toISOString().split("T")[0];
    const [y, m, d] = strDate.split("-").map((num) => parseInt(num, 10));
    const targetDate = new Date(Date.UTC(y, m - 1, d));

    const period = getActivePeriodDates(fechaCorteDay, targetDate);

    const corteRes = await clientOrPool.query(
      `SELECT id FROM cortes_mensuales
       WHERE usuario_id = $1 AND anio = $2 AND mes = $3 AND estado = 'CERRADO'`,
      [usuarioId, period.anio, period.mes]
    );

    return corteRes.rows.length > 0;
  } catch (error) {
    console.error("Error en checkClosedPeriod:", error);
    return false;
  }
};
