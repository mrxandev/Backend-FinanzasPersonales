import { Router } from "express";
import {
  createConceptoEgreso,
  deleteConceptoEgreso,
  getConceptoEgresoById,
  getConceptosEgresos,
  updateConceptoEgreso,
} from "../controllers/conceptos-egresos.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/conceptos-egresos:
 *   get:
 *     summary: Listar conceptos de egresos
 *     tags: [Conceptos de Egresos]
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
 *         name: tipo_egreso_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: renglon_egreso_id
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: Lista de conceptos de egresos obtenida
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Crear nuevo concepto de egreso
 *     tags: [Conceptos de Egresos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo_egreso_id, renglon_egreso_id, descripcion]
 *             properties:
 *               tipo_egreso_id:
 *                 type: string
 *                 format: uuid
 *               renglon_egreso_id:
 *                 type: string
 *                 format: uuid
 *               tipo_pago_defecto_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               descripcion:
 *                 type: string
 *                 example: Compras de Supermercado Mensual
 *               estado:
 *                 type: string
 *                 enum: [ACTIVO, INACTIVO]
 *                 default: ACTIVO
 *     responses:
 *       201:
 *         description: Concepto de egreso creado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.get("/", authMiddleware, getConceptosEgresos);
router.post("/", authMiddleware, authorizeRoles("ADMIN"), createConceptoEgreso);

/**
 * @swagger
 * /api/conceptos-egresos/{id}:
 *   get:
 *     summary: Obtener concepto de egreso por ID
 *     tags: [Conceptos de Egresos]
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
 *         description: Concepto de egreso encontrado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Actualizar concepto de egreso
 *     tags: [Conceptos de Egresos]
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
 *               tipo_egreso_id:
 *                 type: string
 *                 format: uuid
 *               renglon_egreso_id:
 *                 type: string
 *                 format: uuid
 *               tipo_pago_defecto_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               descripcion:
 *                 type: string
 *               estado:
 *                 type: string
 *                 enum: [ACTIVO, INACTIVO]
 *     responses:
 *       200:
 *         description: Concepto de egreso actualizado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Eliminar concepto de egreso
 *     tags: [Conceptos de Egresos]
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
 *         description: Concepto de egreso eliminado
 *       400:
 *         description: No se puede eliminar por tener transacciones asociadas
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authMiddleware, getConceptoEgresoById);
router.put("/:id", authMiddleware, authorizeRoles("ADMIN"), updateConceptoEgreso);
router.delete("/:id", authMiddleware, authorizeRoles("ADMIN"), deleteConceptoEgreso);

export default router;
