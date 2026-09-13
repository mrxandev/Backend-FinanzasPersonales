import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env.js";

const port = env.port;

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TuFinanzas API - Sistema de Gestión de Finanzas Personales",
      version: "1.0.0",
      description:
        "Documentación oficial de la API de Finanzas Personales (TuFinanzas), cubriendo la gestión de usuarios, catálogos contables, registro transaccional con control de límites presupuestarios, cortes mensuales, consultas dinámicas y reportes analíticos.",
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: "Servidor local de desarrollo",
      },
    ],
    tags: [
      { name: "Health", description: "Estado y salud de la API" },
      { name: "Auth", description: "Autenticación y perfil de usuario" },
      { name: "Usuarios", description: "Gestión de usuarios y límites de egreso" },
      { name: "Tipos de Egresos", description: "Catálogo maestro de tipos de egreso" },
      { name: "Tipos de Ingresos", description: "Catálogo maestro de tipos de ingreso" },
      { name: "Renglones de Egresos", description: "Clasificación presupuestaria de egresos" },
      { name: "Tipos de Pago", description: "Vías o medios de pago disponibles" },
      { name: "Conceptos de Egresos", description: "Plantillas o conceptos de gastos y egresos" },
      { name: "Conceptos de Ingresos", description: "Plantillas o fuentes de ingresos" },
      { name: "Transacciones", description: "Registro y gestión de movimientos financieros" },
      { name: "Cortes Mensuales", description: "Procesamiento y balance de cierres periódicos" },
      { name: "Consultas", description: "Búsqueda analítica combinada y totales acumulados" },
      { name: "Reportes", description: "Reportes analíticos consolidados y control presupuestario" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operación realizada con éxito" },
            data: { type: "object" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Descripción del error ocurrido" },
            errors: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        Usuario: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            cedula: { type: "string", example: "00100000000" },
            nombre: { type: "string", example: "Alexander Martínez" },
            email: { type: "string", format: "email", example: "alexander@finanzas.com" },
            limite_egresos: { type: "number", example: 50000.0 },
            tipo_persona: { type: "string", enum: ["FISICA", "JURIDICA"], example: "FISICA" },
            fecha_corte: { type: "integer", example: 15 },
            role: { type: "string", enum: ["USER", "ADMIN"], example: "USER" },
            estado: { type: "string", enum: ["ACTIVO", "INACTIVO", "SUSPENDIDO"], example: "ACTIVO" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["cedula", "nombre", "email", "password"],
          properties: {
            cedula: { type: "string", example: "00100000000" },
            nombre: { type: "string", example: "Alexander Martínez" },
            email: { type: "string", format: "email", example: "alexander@finanzas.com" },
            password: { type: "string", format: "password", example: "Password123" },
            tipo_persona: { type: "string", enum: ["FISICA", "JURIDICA"], default: "FISICA" },
            limite_egresos: { type: "number", example: 35000.0, default: 0 },
            fecha_corte: { type: "integer", example: 1, default: 1 },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["password"],
          properties: {
            email: { type: "string", format: "email", example: "admin@finanzas.unapec.edu.do" },
            cedula: { type: "string", example: "00100000000" },
            password: { type: "string", format: "password", example: "Admin123456" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Sesión iniciada correctamente" },
            data: {
              type: "object",
              properties: {
                token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsIn..." },
                usuario: { $ref: "#/components/schemas/Usuario" },
              },
            },
          },
        },
        TipoEgreso: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            descripcion: { type: "string", example: "Gasto" },
            estado: { type: "string", enum: ["ACTIVO", "INACTIVO"], example: "ACTIVO" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        TipoIngreso: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            descripcion: { type: "string", example: "Salario Base" },
            estado: { type: "string", enum: ["ACTIVO", "INACTIVO"], example: "ACTIVO" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        RenglonEgreso: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            descripcion: { type: "string", example: "Alimentación / Supermercado" },
            estado: { type: "string", enum: ["ACTIVO", "INACTIVO"], example: "ACTIVO" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        TipoPago: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            descripcion: { type: "string", example: "Tarjeta de Crédito" },
            estado: { type: "string", enum: ["ACTIVO", "INACTIVO"], example: "ACTIVO" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        ConceptoEgreso: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            tipo_egreso_id: { type: "string", format: "uuid" },
            tipo_egreso_descripcion: { type: "string", example: "Gasto" },
            renglon_egreso_id: { type: "string", format: "uuid" },
            renglon_egreso_descripcion: { type: "string", example: "Alimentación / Supermercado" },
            tipo_pago_defecto_id: { type: "string", format: "uuid", nullable: true },
            tipo_pago_descripcion: { type: "string", example: "Tarjeta de Débito", nullable: true },
            descripcion: { type: "string", example: "Compras de Supermercado Mensual" },
            estado: { type: "string", enum: ["ACTIVO", "INACTIVO"], example: "ACTIVO" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        ConceptoIngreso: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            tipo_ingreso_id: { type: "string", format: "uuid" },
            tipo_ingreso_descripcion: { type: "string", example: "Salario Base" },
            descripcion: { type: "string", example: "Sueldo Fijo Mensual" },
            institucion: { type: "string", example: "Empresa XYZ", nullable: true },
            estado: { type: "string", enum: ["ACTIVO", "INACTIVO"], example: "ACTIVO" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Transaccion: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            numero_transaccion: { type: "string", example: "TRX-202609-00001" },
            tipo_transaccion: { type: "string", enum: ["INGRESO", "EGRESO"], example: "EGRESO" },
            usuario_id: { type: "string", format: "uuid" },
            usuario_nombre: { type: "string", example: "Alexander Martínez" },
            concepto_egreso_id: { type: "string", format: "uuid", nullable: true },
            concepto_ingreso_id: { type: "string", format: "uuid", nullable: true },
            tipo_pago_id: { type: "string", format: "uuid", nullable: true },
            tipo_pago_descripcion: { type: "string", example: "Tarjeta de Crédito", nullable: true },
            fecha_transaccion: { type: "string", format: "date", example: "2026-09-12" },
            fecha_registro: { type: "string", format: "date-time" },
            monto: { type: "number", example: 4500.0 },
            numero_tarjeta_credito: { type: "string", example: "4532********1234", nullable: true },
            comentario: { type: "string", example: "Supermercado quincenal", nullable: true },
            estado: { type: "string", enum: ["APLICADA", "PENDIENTE", "ANULADA"], example: "APLICADA" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        CorteMensual: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            usuario_id: { type: "string", format: "uuid" },
            anio: { type: "integer", example: 2026 },
            mes: { type: "integer", example: 9 },
            fecha_corte: { type: "string", format: "date", example: "2026-09-15" },
            balance_inicial: { type: "number", example: 10500.0 },
            total_ingresos: { type: "number", example: 65000.0 },
            total_egresos: { type: "number", example: 48000.0 },
            balance_al_corte: { type: "number", example: 27500.0 },
            limite_egresos_periodo: { type: "number", example: 50000.0 },
            supero_limite: { type: "boolean", example: false },
            estado: { type: "string", enum: ["ABIERTO", "CERRADO"], example: "CERRADO" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Token no proporcionado o inválido",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        Forbidden: {
          description: "Permisos insuficientes para el recurso solicitado",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        NotFound: {
          description: "Recurso no encontrado en el sistema",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
    },
    paths: {
      "/": {
        get: {
          summary: "Health de la API TuFinanzas",
          tags: ["Health"],
          responses: {
            200: {
              description: "API de Finanzas Personales disponible y operativa",
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js", "./src/routes/**/*.js"],
};

export const swaggerSpec = swaggerJsdoc(options);
