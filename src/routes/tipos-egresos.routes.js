import { Router } from "express";
import {
  createTipoEgreso,
  deleteTipoEgreso,
  getTipoEgresoById,
  getTiposEgresos,
  updateTipoEgreso,
} from "../controllers/tipos-egresos.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/tipos-egresos:
 *   get:
 *     summary: Listar tipos de egresos
 *     tags: [Tipos de Egresos]
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
 *         description: Lista de tipos de egresos obtenida exitosamente
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Crear nuevo tipo de egreso
 *     tags: [Tipos de Egresos]
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
 *                 example: Gasto
 *               estado:
 *                 type: string
 *                 enum: [ACTIVO, INACTIVO]
 *                 default: ACTIVO
 *     responses:
 *       201:
 *         description: Tipo de egreso creado
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Tipo de egreso ya existe
 */
router.get("/", authMiddleware, getTiposEgresos);
router.post("/", authMiddleware, authorizeRoles("ADMIN"), createTipoEgreso);

/**
 * @swagger
 * /api/tipos-egresos/{id}:
 *   get:
 *     summary: Obtener tipo de egreso por ID
 *     tags: [Tipos de Egresos]
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
 *         description: Tipo de egreso encontrado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Actualizar tipo de egreso
 *     tags: [Tipos de Egresos]
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
 *         description: Tipo de egreso actualizado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Eliminar tipo de egreso
 *     tags: [Tipos de Egresos]
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
 *         description: Tipo de egreso eliminado
 *       400:
 *         description: No se puede eliminar por tener conceptos asociados
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authMiddleware, getTipoEgresoById);
router.put("/:id", authMiddleware, authorizeRoles("ADMIN"), updateTipoEgreso);
router.delete("/:id", authMiddleware, authorizeRoles("ADMIN"), deleteTipoEgreso);

export default router;
