import { Router } from "express";
import {
  getReporteCorteDetallado,
  getReporteCortes,
  getReporteLimites,
  getResumenAnual,
} from "../controllers/reportes.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/reportes/cortes:
 *   get:
 *     summary: Reporte consolidado de cortes anuales con totales
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: anio
 *         schema:
 *           type: integer
 *           example: 2026
 *       - in: query
 *         name: usuario_id
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reporte consolidado de cortes
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/cortes", authMiddleware, getReporteCortes);

/**
 * @swagger
 * /api/reportes/cortes/{id}:
 *   get:
 *     summary: Reporte detallado de un corte específico con desglose por renglón y tipo de ingreso
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reporte analítico detallado del corte mensual
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/cortes/:id", authMiddleware, getReporteCorteDetallado);

/**
 * @swagger
 * /api/reportes/limites:
 *   get:
 *     summary: Reporte de cumplimiento y excesos de límites de egreso
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: usuario_id
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Estadísticas de cumplimiento y sobrepaso de límites
 */
router.get("/limites", authMiddleware, getReporteLimites);

/**
 * @swagger
 * /api/reportes/resumen-anual:
 *   get:
 *     summary: Reporte con evolución mes a mes del año financiero
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: anio
 *         schema:
 *           type: integer
 *           example: 2026
 *       - in: query
 *         name: usuario_id
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Evolución mes a mes de los balances e ingresos/egresos
 */
router.get("/resumen-anual", authMiddleware, getResumenAnual);

export default router;
