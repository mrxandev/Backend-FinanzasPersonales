import bcrypt from "bcryptjs";
import { pool } from "../db/connection.js";
import { generateToken } from "../utils/jwt.js";
import { fail, ok } from "../utils/response.js";
import { createSystemLog } from "../utils/systemLog.js";
import { isValidDominicanCedula, isValidRNC } from "../utils/validation.js";

export const publicUserFields = `
  id, cedula, nombre, email, role, estado, limite_egresos, tipo_persona, fecha_corte, created_at, updated_at
`;

export const normalizeCedula = (cedula) => String(cedula || "").replace(/\D/g, "");

export const register = async (req, res) => {
  try {
    let {
      cedula,
      nombre,
      email,
      password,
      tipo_persona = "FISICA",
      limite_egresos = 0,
      fecha_corte = 1,
    } = req.body;

    if (!cedula || !nombre || !email || !password) {
      return fail(res, "Cédula, nombre, email y contraseña son obligatorios", 400);
    }

    cedula = normalizeCedula(cedula);
    email = email.trim().toLowerCase();
    nombre = nombre.trim();
    fecha_corte = parseInt(fecha_corte, 10) || 1;
    limite_egresos = parseFloat(limite_egresos) || 0;

    if (cedula.length !== 9 && cedula.length !== 11) {
      return fail(res, "La cédula debe tener 11 dígitos o el RNC 9 dígitos", 400);
    }

    if (cedula.length === 11 && !isValidDominicanCedula(cedula)) {
      return fail(res, "La cédula ingresada no es válida según el algoritmo de verificación dominicano (Módulo 10)", 400);
    }

    if (cedula.length === 9 && !isValidRNC(cedula)) {
      return fail(res, "El RNC ingresado no es válido según el algoritmo de verificación dominicano", 400);
    }

    if (password.length < 6) {
      return fail(res, "La contraseña debe tener al menos 6 caracteres", 400);
    }

    if (fecha_corte < 1 || fecha_corte > 31) {
      return fail(res, "La fecha de corte debe ser un día entre 1 y 31", 400);
    }

    if (limite_egresos < 0) {
      return fail(res, "El límite de egresos no puede ser negativo", 400);
    }

    const existingUser = await pool.query(
      "SELECT id FROM usuarios WHERE email = $1 OR cedula = $2",
      [email, cedula]
    );

    if (existingUser.rows.length > 0) {
      return fail(res, "El correo electrónico o la cédula ya se encuentran registrados", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO usuarios (cedula, nombre, email, password, role, estado, tipo_persona, limite_egresos, fecha_corte)
       VALUES ($1, $2, $3, $4, 'USER', 'ACTIVO', $5, $6, $7)
       RETURNING ${publicUserFields}`,
      [cedula, nombre, email, hashedPassword, tipo_persona.toUpperCase(), limite_egresos, fecha_corte]
    );

    const user = result.rows[0];
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    await createSystemLog({
      actorId: user.id,
      targetUserId: user.id,
      action: "REGISTER_USER",
      entityType: "USUARIO",
      entityId: user.id,
      newValues: { email: user.email, role: user.role },
      req,
    });

    return ok(res, "Usuario registrado exitosamente", { token, usuario: user }, 201);
  } catch (error) {
    console.error("Error en register:", error);
    return fail(res, "Error al registrar el usuario", 500);
  }
};

export const login = async (req, res) => {
  try {
    let { email, cedula, password } = req.body;

    if ((!email && !cedula) || !password) {
      return fail(res, "Debes ingresar correo o cédula, y tu contraseña", 400);
    }

    let queryText = "SELECT id, password, estado FROM usuarios WHERE ";
    let queryParam = "";

    if (email) {
      queryText += "LOWER(email) = $1";
      queryParam = email.trim().toLowerCase();
    } else {
      queryText += "cedula = $1";
      queryParam = normalizeCedula(cedula);
    }

    const result = await pool.query(queryText, [queryParam]);

    if (result.rows.length === 0) {
      return fail(res, "Credenciales incorrectas", 401);
    }

    const userAuth = result.rows[0];

    if (userAuth.estado !== "ACTIVO") {
      return fail(res, "Tu cuenta no se encuentra activa en el sistema", 403);
    }

    const isMatch = await bcrypt.compare(password, userAuth.password);
    if (!isMatch) {
      return fail(res, "Credenciales incorrectas", 401);
    }

    const userResult = await pool.query(
      `SELECT ${publicUserFields} FROM usuarios WHERE id = $1`,
      [userAuth.id]
    );
    const user = userResult.rows[0];
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    await createSystemLog({
      actorId: user.id,
      action: "LOGIN",
      entityType: "USUARIO",
      entityId: user.id,
      req,
    });

    return ok(res, "Sesión iniciada exitosamente", { token, usuario: user });
  } catch (error) {
    console.error("Error en login:", error);
    return fail(res, "Error al iniciar sesión", 500);
  }
};

export const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${publicUserFields} FROM usuarios WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return fail(res, "Usuario no encontrado", 404);
    }

    return ok(res, "Perfil de usuario obtenido exitosamente", { usuario: result.rows[0] });
  } catch (error) {
    console.error("Error en getProfile:", error);
    return fail(res, "Error al obtener perfil de usuario", 500);
  }
};

export const changePassword = async (req, res) => {
  try {
    const { password_actual, password_nueva } = req.body;

    if (!password_actual || !password_nueva) {
      return fail(res, "Se requiere la contraseña actual y la nueva contraseña", 400);
    }

    if (password_nueva.length < 6) {
      return fail(res, "La nueva contraseña debe tener al menos 6 caracteres", 400);
    }

    const userResult = await pool.query("SELECT password FROM usuarios WHERE id = $1", [req.user.id]);
    const isMatch = await bcrypt.compare(password_actual, userResult.rows[0].password);

    if (!isMatch) {
      return fail(res, "La contraseña actual no es correcta", 400);
    }

    const hashedPassword = await bcrypt.hash(password_nueva, 10);
    await pool.query("UPDATE usuarios SET password = $1, updated_at = NOW() WHERE id = $2", [
      hashedPassword,
      req.user.id,
    ]);

    await createSystemLog({
      actorId: req.user.id,
      targetUserId: req.user.id,
      action: "CHANGE_PASSWORD",
      entityType: "USUARIO",
      entityId: req.user.id,
      req,
    });

    return ok(res, "Contraseña actualizada exitosamente");
  } catch (error) {
    console.error("Error en changePassword:", error);
    return fail(res, "Error al cambiar la contraseña", 500);
  }
};
