import { Router } from "express";
import {
  createUsuario,
  deleteUsuario,
  getLimiteStatus,
  getUsuarioById,
  getUsuarios,
  updateUsuario,
} from "../controllers/usuarios.controller.js";
import { authMiddleware, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/usuarios:
 *   get:
 *     summary: Listar usuarios
 *     tags: [Usuarios]
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, ADMIN]
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [ACTIVO, INACTIVO, SUSPENDIDO]
 *       - in: query
 *         name: busqueda
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *   post:
 *     summary: Crear usuario (solo ADMIN)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Usuario creado
 *       400:
 *         description: Datos inválidos
 */
router.get("/", authMiddleware, authorizeRoles("ADMIN"), getUsuarios);
router.post("/", authMiddleware, authorizeRoles("ADMIN"), createUsuario);

/**
 * @swagger
 * /api/usuarios/{id}/limite-status:
 *   get:
 *     summary: Consultar estado en tiempo real del límite de egresos del usuario
 *     tags: [Usuarios]
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
 *         description: Estado del límite obtenido con detalle de consumo y periodo
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id/limite-status", authMiddleware, getLimiteStatus);

/**
 * @swagger
 * /api/usuarios/{id}:
 *   get:
 *     summary: Obtener usuario por ID
 *     tags: [Usuarios]
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
 *         description: Usuario encontrado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Actualizar usuario
 *     tags: [Usuarios]
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
 *               nombre:
 *                 type: string
 *               limite_egresos:
 *                 type: number
 *               tipo_persona:
 *                 type: string
 *                 enum: [FISICA, JURIDICA]
 *               fecha_corte:
 *                 type: integer
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
 *               estado:
 *                 type: string
 *                 enum: [ACTIVO, INACTIVO, SUSPENDIDO]
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Eliminar usuario
 *     tags: [Usuarios]
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
 *         description: Usuario eliminado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authMiddleware, getUsuarioById);
router.put("/:id", authMiddleware, updateUsuario);
router.delete("/:id", authMiddleware, authorizeRoles("ADMIN"), deleteUsuario);

export default router;
