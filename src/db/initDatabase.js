import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { env } from "../config/env.js";
import { pool } from "./connection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);

    // 1. Sembrar Administrador por defecto si no existe
    const adminEmail = env.admin.email.toLowerCase();
    const existingAdmin = await pool.query(
      "SELECT id FROM usuarios WHERE email = $1 OR cedula = $2",
      [adminEmail, env.admin.cedula]
    );

    if (existingAdmin.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(env.admin.password, 10);
      await pool.query(
        `INSERT INTO usuarios (cedula, nombre, email, password, role, estado, tipo_persona, limite_egresos, fecha_corte)
         VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVO', 'FISICA', 100000.00, 1)`,
        [env.admin.cedula, env.admin.nombre, adminEmail, hashedPassword]
      );
      console.log("✔ Administrador inicial creado exitosamente");
    }

    // 2. Sembrar Catálogos Maestros (Tipos de Egresos)
    const tiposEgresos = ["Gasto", "Inversión", "Costo Operativo", "Emergencia"];
    for (const te of tiposEgresos) {
      await pool.query(
        `INSERT INTO tipos_egresos (descripcion, estado)
         VALUES ($1, 'ACTIVO')
         ON CONFLICT (descripcion) DO NOTHING`,
        [te]
      );
    }

    // 3. Sembrar Catálogos Maestros (Tipos de Ingresos)
    const tiposIngresos = [
      "Salario Base",
      "Horas Extras",
      "Comisiones",
      "Honorarios Profesionales",
      "Rendimientos de Inversión",
      "Otros Ingresos",
    ];
    for (const ti of tiposIngresos) {
      await pool.query(
        `INSERT INTO tipos_ingresos (descripcion, estado)
         VALUES ($1, 'ACTIVO')
         ON CONFLICT (descripcion) DO NOTHING`,
        [ti]
      );
    }

    // 4. Sembrar Catálogos Maestros (Renglones de Egresos)
    const renglonesEgresos = [
      "Alimentación / Supermercado",
      "Transporte / Combustible",
      "Vivienda / Alquiler",
      "Servicios Públicos (Luz/Agua/Internet)",
      "Salud y Farmacia",
      "Educación",
      "Recreación y Ocio",
      "Ropa y Calzado",
      "Deudas y Tarjetas",
    ];
    for (const re of renglonesEgresos) {
      await pool.query(
        `INSERT INTO renglones_egresos (descripcion, estado)
         VALUES ($1, 'ACTIVO')
         ON CONFLICT (descripcion) DO NOTHING`,
        [re]
      );
    }

    // 5. Sembrar Catálogos Maestros (Tipos de Pago)
    const tiposPago = [
      "Efectivo",
      "Tarjeta de Débito",
      "Tarjeta de Crédito",
      "Transferencia Bancaria",
      "Cheque",
    ];
    for (const tp of tiposPago) {
      await pool.query(
        `INSERT INTO tipos_pago (descripcion, estado)
         VALUES ($1, 'ACTIVO')
         ON CONFLICT (descripcion) DO NOTHING`,
        [tp]
      );
    }

    // 6. Sembrar Conceptos de Egresos de muestra si la tabla está vacía
    const conceptosEgresosCount = await pool.query("SELECT COUNT(*) FROM conceptos_egresos");
    if (parseInt(conceptosEgresosCount.rows[0].count, 10) === 0) {
      const teGasto = await pool.query("SELECT id FROM tipos_egresos WHERE descripcion = 'Gasto' LIMIT 1");
      const reComida = await pool.query("SELECT id FROM renglones_egresos WHERE descripcion = 'Alimentación / Supermercado' LIMIT 1");
      const reTrans = await pool.query("SELECT id FROM renglones_egresos WHERE descripcion = 'Transporte / Combustible' LIMIT 1");
      const tpDebito = await pool.query("SELECT id FROM tipos_pago WHERE descripcion = 'Tarjeta de Débito' LIMIT 1");

      if (teGasto.rows[0] && reComida.rows[0]) {
        await pool.query(
          `INSERT INTO conceptos_egresos (tipo_egreso_id, renglon_egreso_id, tipo_pago_defecto_id, descripcion, estado)
           VALUES ($1, $2, $3, $4, 'ACTIVO')`,
          [teGasto.rows[0].id, reComida.rows[0].id, tpDebito.rows[0]?.id || null, "Compras de Supermercado Mensual"]
        );
      }

      if (teGasto.rows[0] && reTrans.rows[0]) {
        await pool.query(
          `INSERT INTO conceptos_egresos (tipo_egreso_id, renglon_egreso_id, tipo_pago_defecto_id, descripcion, estado)
           VALUES ($1, $2, $3, $4, 'ACTIVO')`,
          [teGasto.rows[0].id, reTrans.rows[0].id, tpDebito.rows[0]?.id || null, "Combustible y Peajes"]
        );
      }
    }

    // 7. Sembrar Conceptos de Ingresos de muestra si la tabla está vacía
    const conceptosIngresosCount = await pool.query("SELECT COUNT(*) FROM conceptos_ingresos");
    if (parseInt(conceptosIngresosCount.rows[0].count, 10) === 0) {
      const tiSalario = await pool.query("SELECT id FROM tipos_ingresos WHERE descripcion = 'Salario Base' LIMIT 1");
      if (tiSalario.rows[0]) {
        await pool.query(
          `INSERT INTO conceptos_ingresos (tipo_ingreso_id, descripcion, institucion, estado)
           VALUES ($1, $2, $3, 'ACTIVO')`,
          [tiSalario.rows[0].id, "Sueldo Quincenal / Mensual", "Empresa Principal"]
        );
      }
    }

    console.log("✔ Tablas verificadas, esquema aplicado y semillas insertadas correctamente");
  } catch (error) {
    console.error("Error al inicializar la base de datos:", error.message);
    throw error;
  }
};
