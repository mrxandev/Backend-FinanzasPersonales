import { Router } from "express";
import {
  createRenglonEgreso,
  deleteRenglonEgreso,
  getRenglonEgresoById,
  getRenglonesEgresos,
  updateRenglonEgreso,
} from "../controllers/renglones-egresos.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/renglones-egresos:
 *   get:
 *     summary: Listar renglones de egresos
 *     tags: [Renglones de Egresos]
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
 *         description: Lista de renglones de egresos obtenida
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Crear nuevo renglón de egreso
 *     tags: [Renglones de Egresos]
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
 *                 example: Alimentación / Supermercado
 *               estado:
 *                 type: string
 *                 enum: [ACTIVO, INACTIVO]
 *                 default: ACTIVO
 *     responses:
 *       201:
 *         description: Renglón creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Renglón duplicado
 */
router.get("/", authMiddleware, getRenglonesEgresos);
router.post("/", authMiddleware, authorizeRoles("ADMIN"), createRenglonEgreso);

/**
 * @swagger
 * /api/renglones-egresos/{id}:
 *   get:
 *     summary: Obtener renglón de egreso por ID
 *     tags: [Renglones de Egresos]
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
 *         description: Renglón encontrado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Actualizar renglón de egreso
 *     tags: [Renglones de Egresos]
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
 *         description: Renglón actualizado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Eliminar renglón de egreso
 *     tags: [Renglones de Egresos]
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
 *         description: Renglón eliminado
 *       400:
 *         description: No se puede eliminar por tener conceptos asociados
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authMiddleware, getRenglonEgresoById);
router.put("/:id", authMiddleware, authorizeRoles("ADMIN"), updateRenglonEgreso);
router.delete("/:id", authMiddleware, authorizeRoles("ADMIN"), deleteRenglonEgreso);

export default router;
