import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const port = process.env.PORT || 3000;
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn("node", ["index.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), CHECK_SWAGGER: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (chunk) => process.stdout.write(chunk));
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  let ready = false;
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.status === 200) {
        ready = true;
        break;
      }
    } catch {
      await wait(1000);
    }
  }

  if (!ready) {
    throw new Error("El servidor no inició en el tiempo esperado");
  }

  // 1. Verificar endpoint de Swagger UI
  const docsResponse = await fetch(`${baseUrl}/api-docs`);
  const docsHtml = await docsResponse.text();
  console.log(`[CHECK] /api-docs -> Status: ${docsResponse.status}, Contiene Swagger UI: ${docsHtml.includes("Swagger UI")}`);

  if (docsResponse.status !== 200 || !docsHtml.includes("Swagger UI")) {
    throw new Error("/api-docs no cargó Swagger UI correctamente");
  }

  // 2. Verificar especificación JSON OpenAPI 3.0
  const specResponse = await fetch(`${baseUrl}/api-docs.json`);
  const spec = await specResponse.json();
  const pathCount = Object.keys(spec.paths || {}).length;
  const hasBearer = Boolean(spec.components?.securitySchemes?.bearerAuth);

  console.log(`[CHECK] /api-docs.json -> Status: ${specResponse.status}, Rutas registradas: ${pathCount}, BearerAuth: ${hasBearer}`);

  if (specResponse.status !== 200 || !hasBearer) {
    throw new Error("/api-docs.json no expone bearerAuth o falló la respuesta");
  }

  if (pathCount < 10) {
    throw new Error(`Se esperaban más de 10 rutas documentadas en OpenAPI, se encontraron ${pathCount}`);
  }

  console.log("✔ Verificación de OpenAPI y Swagger superada con éxito.");
} finally {
  server.kill();
}
