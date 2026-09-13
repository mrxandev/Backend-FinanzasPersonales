import { Router } from "express";
import { consultarTransacciones } from "../controllers/consultas.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/consultas:
 *   get:
 *     summary: Consulta multidimensional de transacciones con totales y balance acumulado
 *     description: Permite buscar y filtrar transacciones por múltiples criterios cruzados (usuario, fechas, tipos, renglones, formas de pago, montos) devolviendo la lista paginada y el resumen con totales de ingresos, egresos y balance neto.
 *     tags: [Consultas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: usuario_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: tipo_transaccion
 *         schema:
 *           type: string
 *           enum: [INGRESO, EGRESO]
 *       - in: query
 *         name: tipo_egreso_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: tipo_ingreso_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: renglon_egreso_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: tipo_pago_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [APLICADA, PENDIENTE, ANULADA]
 *       - in: query
 *         name: monto_min
 *         schema:
 *           type: number
 *       - in: query
 *         name: monto_max
 *         schema:
 *           type: number
 *       - in: query
 *         name: busqueda
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Resultados de la consulta analítica con totales acumulados y listado
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", authMiddleware, consultarTransacciones);

export default router;
