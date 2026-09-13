import { Router } from "express";
import {
  createTipoIngreso,
  deleteTipoIngreso,
  getTipoIngresoById,
  getTiposIngresos,
  updateTipoIngreso,
} from "../controllers/tipos-ingresos.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/tipos-ingresos:
 *   get:
 *     summary: Listar tipos de ingresos
 *     tags: [Tipos de Ingresos]
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
 *         description: Lista de tipos de ingresos
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Crear nuevo tipo de ingreso
 *     tags: [Tipos de Ingresos]
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
 *                 example: Salario Base
 *               estado:
 *                 type: string
 *                 enum: [ACTIVO, INACTIVO]
 *                 default: ACTIVO
 *     responses:
 *       201:
 *         description: Tipo de ingreso creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Tipo de ingreso duplicado
 */
router.get("/", authMiddleware, getTiposIngresos);
router.post("/", authMiddleware, authorizeRoles("ADMIN"), createTipoIngreso);

/**
 * @swagger
 * /api/tipos-ingresos/{id}:
 *   get:
 *     summary: Obtener tipo de ingreso por ID
 *     tags: [Tipos de Ingresos]
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
 *         description: Tipo de ingreso encontrado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Actualizar tipo de ingreso
 *     tags: [Tipos de Ingresos]
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
 *         description: Tipo de ingreso actualizado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Eliminar tipo de ingreso
 *     tags: [Tipos de Ingresos]
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
 *         description: Tipo de ingreso eliminado
 *       400:
 *         description: No se puede eliminar porque tiene conceptos asociados
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authMiddleware, getTipoIngresoById);
router.put("/:id", authMiddleware, authorizeRoles("ADMIN"), updateTipoIngreso);
router.delete("/:id", authMiddleware, authorizeRoles("ADMIN"), deleteTipoIngreso);

export default router;
