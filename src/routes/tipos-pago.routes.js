import { Router } from "express";
import {
  createTipoPago,
  deleteTipoPago,
  getTipoPagoById,
  getTiposPago,
  updateTipoPago,
} from "../controllers/tipos-pago.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/tipos-pago:
 *   get:
 *     summary: Listar tipos de pago
 *     tags: [Tipos de Pago]
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
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [ACTIVO, INACTIVO]
 *       - in: query
 *         name: busqueda
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de tipos de pago obtenida
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Crear nuevo tipo de pago
 *     tags: [Tipos de Pago]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [descripcion]
 *             properties:
 *               descripcion:
 *                 type: string
 *                 example: Tarjeta de Crédito
 *               estado:
 *                 type: string
 *                 enum: [ACTIVO, INACTIVO]
 *                 default: ACTIVO
 *     responses:
 *       201:
 *         description: Tipo de pago creado
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Tipo de pago duplicado
 */
router.get("/", authMiddleware, getTiposPago);
router.post("/", authMiddleware, authorizeRoles("ADMIN"), createTipoPago);

/**
 * @swagger
 * /api/tipos-pago/{id}:
 *   get:
 *     summary: Obtener tipo de pago por ID
 *     tags: [Tipos de Pago]
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
 *         description: Tipo de pago encontrado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Actualizar tipo de pago
 *     tags: [Tipos de Pago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               descripcion:
 *                 type: string
 *               estado:
 *                 type: string
 *                 enum: [ACTIVO, INACTIVO]
 *     responses:
 *       200:
 *         description: Tipo de pago actualizado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Eliminar tipo de pago
 *     tags: [Tipos de Pago]
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
 *         description: Tipo de pago eliminado
 *       400:
 *         description: No se puede eliminar por transacciones asociadas
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authMiddleware, getTipoPagoById);
router.put("/:id", authMiddleware, authorizeRoles("ADMIN"), updateTipoPago);
router.delete("/:id", authMiddleware, authorizeRoles("ADMIN"), deleteTipoPago);

export default router;
