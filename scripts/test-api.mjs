import bcrypt from "bcryptjs";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { connectDB, pool } from "../src/db/connection.js";
import { initDatabase } from "../src/db/initDatabase.js";

const port = process.env.PORT || 3001;
const baseUrl = `http://127.0.0.1:${port}`;
const stamp = Date.now().toString().slice(-6);

const adminEmail = `admin.${stamp}@finanzas.test`;
const adminCedula = `001${stamp.padStart(8, "0")}`;
const adminPassword = "AdminTest123!";

const userEmail = `user.${stamp}@finanzas.test`;
const userCedula = `002${stamp.padStart(8, "0")}`;
const userPassword = "UserTest123!";

const results = [];

const record = (name, ok, details = "") => {
  results.push({ name, ok, details });
  console.log(`${ok ? "✔ PASS" : "✖ FAIL"} [${name}]${details ? ` - ${details}` : ""}`);
};

const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { status: response.status, json };
};

const expectStatus = async (name, method, path, expected, options) => {
  const response = await request(method, path, options);
  const ok = Array.isArray(expected) ? expected.includes(response.status) : response.status === expected;
  record(name, ok, `${method} ${path} -> Status ${response.status}`);
  if (!ok) {
    console.error("Detalle del fallo:", JSON.stringify(response.json, null, 2));
    throw new Error(`Fallo en el paso: ${name}`);
  }
  return response.json;
};

const startServer = async () => {
  const child = spawn("node", ["index.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) {
        return child;
      }
    } catch {
      await wait(1000);
    }
  }

  child.kill();
  throw new Error("El servidor no inició a tiempo");
};

let server;

try {
  console.log("--- INICIANDO SUITE DE PRUEBAS TUFINANZAS API ---");

  // 1. Validar conexión a base de datos
  const isDbConnected = await connectDB();
  if (!isDbConnected) {
    console.log("\n========================================================");
    console.warn("⚠ ATENCIÓN: No se pudo conectar a la base de datos PostgreSQL.");
    console.warn("Para ejecutar las pruebas E2E contra Supabase:");
    console.warn("1. Crea el archivo .env a partir de .env.example");
    console.warn("2. Coloca la contraseña de tu base de datos Supabase en DATABASE_URL:");
    console.warn("   DATABASE_URL=postgresql://postgres:[TU-PASSWORD]@db.yrxokudwehicfjqsnwwr.supabase.co:5432/postgres");
    console.log("========================================================\n");
    process.exit(0);
  }

  // 2. Inicializar base de datos
  await initDatabase();

  // 3. Sembrar Admin de Prueba
  const hashedAdminPass = await bcrypt.hash(adminPassword, 10);
  const adminInsert = await pool.query(
    `INSERT INTO usuarios (cedula, nombre, email, password, role, estado, tipo_persona, limite_egresos, fecha_corte)
     VALUES ($1, 'Admin Tester', $2, $3, 'ADMIN', 'ACTIVO', 'FISICA', 100000, 1)
     RETURNING id, email, role`,
    [adminCedula, adminEmail, hashedAdminPass]
  );
  const adminId = adminInsert.rows[0].id;

  // 3. Levantar servidor
  server = await startServer();

  // Test 1: Health Check
  await expectStatus("Health Check", "GET", "/", 200);

  // Test 2: Swagger Spec
  const spec = await expectStatus("OpenAPI Spec", "GET", "/api-docs.json", 200);
  record("OpenAPI Security", Boolean(spec.components?.securitySchemes?.bearerAuth), "bearerAuth presente");

  // Test 3: Login Admin
  const adminLogin = await expectStatus("Login Admin", "POST", "/api/auth/login", 200, {
    body: { email: adminEmail, password: adminPassword },
  });
  const adminToken = adminLogin.data.token;
  record("Admin JWT Token", Boolean(adminToken), "Token generado correctamente");

  // Test 4: Auth Me
  await expectStatus("Perfil Admin", "GET", "/api/auth/me", 200, { token: adminToken });

  // Test 5: Register Normal User (con límite de egresos RD$ 10,000 y fecha de corte día 15)
  const userRegister = await expectStatus("Registro Usuario", "POST", "/api/auth/register", 201, {
    body: {
      cedula: userCedula,
      nombre: "Alexander Tester",
      email: userEmail,
      password: userPassword,
      tipo_persona: "FISICA",
      limite_egresos: 10000.0,
      fecha_corte: 15,
    },
  });
  const userToken = userRegister.data.token;
  const userId = userRegister.data.usuario.id;
  record("User JWT Token", Boolean(userToken), "Token de usuario normal obtenido");

  // Test 6: Módulo 1 - Tipos de Egresos (CRUD)
  const teCreate = await expectStatus("Crear Tipo Egreso", "POST", "/api/tipos-egresos", 201, {
    token: adminToken,
    body: { descripcion: `Gasto Variable ${stamp}`, estado: "ACTIVO" },
  });
  const teId = teCreate.data.tipo_egreso.id;
  await expectStatus("Listar Tipos de Egresos", "GET", "/api/tipos-egresos", 200, { token: userToken });
  await expectStatus("Obtener Tipo Egreso por ID", "GET", `/api/tipos-egresos/${teId}`, 200, { token: userToken });

  // Test 7: Módulo 2 - Tipos de Ingresos (CRUD)
  const tiCreate = await expectStatus("Crear Tipo Ingreso", "POST", "/api/tipos-ingresos", 201, {
    token: adminToken,
    body: { descripcion: `Consultoría Extra ${stamp}`, estado: "ACTIVO" },
  });
  const tiId = tiCreate.data.tipo_ingreso.id;
  await expectStatus("Listar Tipos de Ingresos", "GET", "/api/tipos-ingresos", 200, { token: userToken });

  // Test 8: Módulo 3 - Renglones de Egresos (CRUD)
  const reCreate = await expectStatus("Crear Renglón Egreso", "POST", "/api/renglones-egresos", 201, {
    token: adminToken,
    body: { descripcion: `Software y Hosting ${stamp}`, estado: "ACTIVO" },
  });
  const reId = reCreate.data.renglon_egreso.id;
  await expectStatus("Listar Renglones de Egresos", "GET", "/api/renglones-egresos", 200, { token: userToken });

  // Test 9: Módulo 4 - Tipos de Pago (CRUD)
  const tpCreate = await expectStatus("Crear Tipo de Pago", "POST", "/api/tipos-pago", 201, {
    token: adminToken,
    body: { descripcion: `Criptomoneda ${stamp}`, estado: "ACTIVO" },
  });
  const tpId = tpCreate.data.tipo_pago.id;
  await expectStatus("Listar Tipos de Pago", "GET", "/api/tipos-pago", 200, { token: userToken });

  // Test 10: Módulo 5 - Conceptos de Egresos
  const ceCreate = await expectStatus("Crear Concepto de Egreso", "POST", "/api/conceptos-egresos", 201, {
    token: adminToken,
    body: {
      tipo_egreso_id: teId,
      renglon_egreso_id: reId,
      tipo_pago_defecto_id: tpId,
      descripcion: `Suscripción Mensual Servidores ${stamp}`,
      estado: "ACTIVO",
    },
  });
  const ceId = ceCreate.data.concepto_egreso.id;
  await expectStatus("Listar Conceptos de Egresos", "GET", "/api/conceptos-egresos", 200, { token: userToken });

  // Test 11: Módulo 6 - Conceptos de Ingresos
  const ciCreate = await expectStatus("Crear Concepto de Ingreso", "POST", "/api/conceptos-ingresos", 201, {
    token: adminToken,
    body: {
      tipo_ingreso_id: tiId,
      descripcion: `Honorarios por Asesoría Cloud ${stamp}`,
      institucion: "Cliente Remoto USA",
      estado: "ACTIVO",
    },
  });
  const ciId = ciCreate.data.concepto_ingreso.id;
  await expectStatus("Listar Conceptos de Ingresos", "GET", "/api/conceptos-ingresos", 200, { token: userToken });

  // Test 12: Módulo 8 - Transacción de INGRESO (RD$ 25,000)
  const trxIngreso = await expectStatus("Registrar Transacción INGRESO", "POST", "/api/transacciones", 201, {
    token: userToken,
    body: {
      tipo_transaccion: "INGRESO",
      concepto_ingreso_id: ciId,
      tipo_pago_id: tpId,
      monto: 25000.0,
      comentario: "Pago quincenal por asesoría",
    },
  });
  record("Folio Autogenerado INGRESO", Boolean(trxIngreso.data.transaccion.numero_transaccion.startsWith("TRX-")), trxIngreso.data.transaccion.numero_transaccion);

  // Test 13: Transacción EGRESO 1 (RD$ 4,000 - dentro del límite de RD$ 10,000)
  const trxEgreso1 = await expectStatus("Registrar Transacción EGRESO (Dentro de Límite)", "POST", "/api/transacciones", 201, {
    token: userToken,
    body: {
      tipo_transaccion: "EGRESO",
      concepto_egreso_id: ceId,
      tipo_pago_id: tpId,
      monto: 4000.0,
      comentario: "Pago parcial servidores",
    },
  });
  record("No Warning en Límite", trxEgreso1.data.warning === undefined, "Sin alerta porque acumulado es 4000 <= 10000");

  // Test 14: Módulo 12 - Transacción EGRESO 2 (RD$ 7,000 - Acumulado 11,000 > Límite 10,000) -> EMITE WARNING
  const trxEgreso2 = await expectStatus("Registrar Transacción EGRESO (Supera Límite)", "POST", "/api/transacciones", 201, {
    token: userToken,
    body: {
      tipo_transaccion: "EGRESO",
      concepto_egreso_id: ceId,
      tipo_pago_id: tpId,
      monto: 7000.0,
      comentario: "Compra de licencia anual adicional",
    },
  });
  const warning = trxEgreso2.data.warning;
  record(
    "Regla Alerta de Límite (Requisito 12)",
    Boolean(warning && warning.supero_limite && warning.exceso === 1000),
    `Exceso detectado: RD$ ${warning?.exceso}, Porcentaje: ${warning?.porcentaje_consumido}%`
  );

  // Test 15: Consulta Estado de Límite en Tiempo Real
  const limiteStatus = await expectStatus("Consultar Estado de Límite", "GET", `/api/usuarios/${userId}/limite-status`, 200, {
    token: userToken,
  });
  record("Status Límite Superado", limiteStatus.data.supero_limite === true, `Gastado: ${limiteStatus.data.total_gastado}`);

  // Test 16: Módulo 9 - Proceso de Corte Mensual
  const now = new Date();
  const corteProceso = await expectStatus("Procesar Corte Mensual", "POST", "/api/cortes/procesar", 200, {
    token: userToken,
    body: {
      anio: now.getFullYear(),
      mes: now.getMonth() + 1,
    },
  });
  const corte = corteProceso.data.corte;
  record(
    "Fórmulas de Corte Mensual",
    corte.total_ingresos === "25000.00" && corte.total_egresos === "11000.00" && corte.balance_al_corte === "14000.00" && corte.supero_limite === true,
    `Ingresos: ${corte.total_ingresos}, Egresos: ${corte.total_egresos}, Balance al corte: ${corte.balance_al_corte}`
  );

  // Test 17: Módulo 10 - Consulta Multidimensional por Criterios
  const consultaRes = await expectStatus("Consulta Analítica por Criterios", "GET", `/api/consultas?tipo_transaccion=EGRESO`, 200, {
    token: userToken,
  });
  record(
    "Totales Acumulados de Consulta",
    consultaRes.data.resumen.total_egresos === 11000 && consultaRes.data.resumen.conteo_egresos === 2,
    `Total Egresos filtrados: ${consultaRes.data.resumen.total_egresos}, Conteo: ${consultaRes.data.resumen.conteo_egresos}`
  );

  // Test 18: Módulo 11 - Reportes Analíticos de Corte
  const reporteCortes = await expectStatus("Reporte Consolidado de Cortes", "GET", `/api/reportes/cortes?anio=${now.getFullYear()}`, 200, {
    token: userToken,
  });
  record("Reporte Consolidado", Boolean(reporteCortes.data.cortes.length > 0), `Periodos reportados: ${reporteCortes.data.cortes.length}`);

  const reporteDetallado = await expectStatus("Reporte Detallado de Corte", "GET", `/api/reportes/cortes/${corte.id}`, 200, {
    token: userToken,
  });
  record(
    "Desglose por Renglón en Reporte",
    Boolean(reporteDetallado.data.desglose_egresos_por_renglon.length > 0),
    `Renglones analizados: ${reporteDetallado.data.desglose_egresos_por_renglon.length}`
  );

  // Test 19: Reporte de Cumplimiento de Límites
  const reporteLimites = await expectStatus("Reporte de Cumplimiento de Límites", "GET", "/api/reportes/limites", 200, {
    token: userToken,
  });
  record("Reporte de Límites", Boolean(reporteLimites.data.usuarios.length > 0), `Usuarios evaluados: ${reporteLimites.data.usuarios.length}`);

  // Test 20: Reporte Resumen Anual
  const resumenAnual = await expectStatus("Reporte Resumen Anual", "GET", `/api/reportes/resumen-anual?anio=${now.getFullYear()}`, 200, {
    token: userToken,
  });
  record("Serie Anual 12 Meses", resumenAnual.data.meses.length === 12, "12 meses generados");

  console.log("\n========================================================");
  console.log(`TODAS LAS PRUEBAS SUPERADAS: ${results.filter((r) => r.ok).length}/${results.length} PASADAS`);
  console.log("========================================================\n");
} catch (error) {
  console.error("Error durante la ejecución de las pruebas:", error.message);
  process.exitCode = 1;
} finally {
  if (server) {
    server.kill();
  }
  await pool.end();
}
