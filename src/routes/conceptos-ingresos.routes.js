import { Router } from "express";
import {
  createConceptoIngreso,
  deleteConceptoIngreso,
  getConceptoIngresoById,
  getConceptosIngresos,
  updateConceptoIngreso,
} from "../controllers/conceptos-ingresos.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/conceptos-ingresos:
 *   get:
 *     summary: Listar conceptos de ingresos
 *     tags: [Conceptos de Ingresos]
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
 *         name: tipo_ingreso_id
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
 *         description: Lista de conceptos de ingresos obtenida
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Crear nuevo concepto de ingreso
 *     tags: [Conceptos de Ingresos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo_ingreso_id, descripcion]
 *             properties:
 *               tipo_ingreso_id:
 *                 type: string
 *                 format: uuid
 *               descripcion:
 *                 type: string
 *                 example: Sueldo Quincenal
 *               institucion:
 *                 type: string
 *                 example: Empresa Dominicana CXA
 *               estado:
 *                 type: string
 *                 enum: [ACTIVO, INACTIVO]
 *                 default: ACTIVO
 *     responses:
 *       201:
 *         description: Concepto de ingreso creado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.get("/", authMiddleware, getConceptosIngresos);
router.post("/", authMiddleware, authorizeRoles("ADMIN"), createConceptoIngreso);

/**
 * @swagger
 * /api/conceptos-ingresos/{id}:
 *   get:
 *     summary: Obtener concepto de ingreso por ID
 *     tags: [Conceptos de Ingresos]
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
 *         description: Concepto de ingreso encontrado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Actualizar concepto de ingreso
 *     tags: [Conceptos de Ingresos]
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
 *               tipo_ingreso_id:
 *                 type: string
 *                 format: uuid
 *               descripcion:
 *                 type: string
 *               institucion:
 *                 type: string
 *               estado:
 *                 type: string
 *                 enum: [ACTIVO, INACTIVO]
 *     responses:
 *       200:
 *         description: Concepto de ingreso actualizado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Eliminar concepto de ingreso
 *     tags: [Conceptos de Ingresos]
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
 *         description: Concepto de ingreso eliminado
 *       400:
 *         description: No se puede eliminar por tener transacciones asociadas
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authMiddleware, getConceptoIngresoById);
router.put("/:id", authMiddleware, authorizeRoles("ADMIN"), updateConceptoIngreso);
router.delete("/:id", authMiddleware, authorizeRoles("ADMIN"), deleteConceptoIngreso);

export default router;
