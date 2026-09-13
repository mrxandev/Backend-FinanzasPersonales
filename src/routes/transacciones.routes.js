import { Router } from "express";
import {
  anularTransaccion,
  createTransaccion,
  deleteTransaccion,
  getTransaccionById,
  getTransacciones,
  updateTransaccion,
} from "../controllers/transacciones.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/transacciones:
 *   get:
 *     summary: Listar transacciones con filtros
 *     tags: [Transacciones]
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
 *         name: tipo_transaccion
 *         schema:
 *           type: string
 *           enum: [INGRESO, EGRESO]
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [APLICADA, PENDIENTE, ANULADA]
 *       - in: query
 *         name: tipo_pago_id
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
 *         name: busqueda
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Listado de transacciones obtenido
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Registrar una nueva transacción (Ingreso o Egreso)
 *     description: Registra la transacción con folio correlativo autogenerado. Si el egreso excede el límite mensual del usuario, retorna un objeto warning con los detalles del exceso sin bloquear el registro.
 *     tags: [Transacciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo_transaccion, monto]
 *             properties:
 *               tipo_transaccion:
 *                 type: string
 *                 enum: [INGRESO, EGRESO]
 *                 example: EGRESO
 *               usuario_id:
 *                 type: string
 *                 format: uuid
 *                 description: Opcional si es ADMIN; por defecto toma el usuario autenticado.
 *               concepto_egreso_id:
 *                 type: string
 *                 format: uuid
 *                 description: Obligatorio si tipo_transaccion es EGRESO.
 *               concepto_ingreso_id:
 *                 type: string
 *                 format: uuid
 *                 description: Obligatorio si tipo_transaccion es INGRESO.
 *               tipo_pago_id:
 *                 type: string
 *                 format: uuid
 *               fecha_transaccion:
 *                 type: string
 *                 format: date
 *                 example: 2026-09-12
 *               monto:
 *                 type: number
 *                 example: 1250.50
 *               numero_tarjeta_credito:
 *                 type: string
 *                 example: 4532********9876
 *               comentario:
 *                 type: string
 *                 example: Compra de insumos
 *               estado:
 *                 type: string
 *                 enum: [APLICADA, PENDIENTE]
 *                 default: APLICADA
 *     responses:
 *       201:
 *         description: Transacción registrada exitosamente (posible warning de límite incluido)
 *       400:
 *         description: Datos requeridos inválidos
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", authMiddleware, getTransacciones);
router.post("/", authMiddleware, createTransaccion);

/**
 * @swagger
 * /api/transacciones/{id}:
 *   get:
 *     summary: Obtener transacción por ID
 *     tags: [Transacciones]
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
 *         description: Transacción obtenida
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Actualizar transacción
 *     tags: [Transacciones]
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
 *               monto:
 *                 type: number
 *               comentario:
 *                 type: string
 *               tipo_pago_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Transacción actualizada
 *       400:
 *         description: No se puede editar transacción anulada
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Eliminar transacción (solo ADMIN)
 *     tags: [Transacciones]
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
 *         description: Transacción eliminada
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authMiddleware, getTransaccionById);
router.put("/:id", authMiddleware, updateTransaccion);
router.delete("/:id", authMiddleware, authorizeRoles("ADMIN"), deleteTransaccion);

/**
 * @swagger
 * /api/transacciones/{id}/anular:
 *   patch:
 *     summary: Anular una transacción
 *     tags: [Transacciones]
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *                 example: Error en digitación del monto
 *     responses:
 *       200:
 *         description: Transacción anulada
 *       400:
 *         description: La transacción ya está anulada
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch("/:id/anular", authMiddleware, anularTransaccion);

export default router;
