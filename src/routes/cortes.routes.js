import { Router } from "express";
import {
  getCorteById,
  getCortes,
  procesarCorte,
} from "../controllers/cortes.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/cortes:
 *   get:
 *     summary: Listar cortes mensuales cerrados
 *     tags: [Cortes Mensuales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: usuario_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: anio
 *         schema:
 *           type: integer
 *       - in: query
 *         name: mes
 *         schema:
 *           type: integer
 *       - in: query
 *         name: supero_limite
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Listado de cortes mensuales obtenido exitosamente
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", authMiddleware, getCortes);

/**
 * @swagger
 * /api/cortes/procesar:
 *   post:
 *     summary: Procesar cierre de corte mensual
 *     description: Realiza el corte mensual para un usuario o masivamente para todos los usuarios. Arrastra balance anterior, acumula ingresos y egresos aplicados, calcula balance al corte y evalúa superación de límite.
 *     tags: [Cortes Mensuales]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuario_id:
 *                 type: string
 *                 format: uuid
 *               anio:
 *                 type: integer
 *                 example: 2026
 *               mes:
 *                 type: integer
 *                 example: 9
 *               todos:
 *                 type: boolean
 *                 example: false
 *                 description: Solo permitido para administradores para procesar todos los usuarios
 *     responses:
 *       200:
 *         description: Corte mensual procesado satisfactoriamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/procesar", authMiddleware, procesarCorte);

/**
 * @swagger
 * /api/cortes/{id}:
 *   get:
 *     summary: Obtener detalle y transacciones de un corte mensual
 *     tags: [Cortes Mensuales]
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
 *         description: Detalle del corte y lista de transacciones del periodo
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authMiddleware, getCorteById);

export default router;
