# Backend Sistema de Gestión de Finanzas Personales — TuFinanzas

Backend robusto, modular y documentado para el **Sistema de Gestión de Finanzas Personales (TuFinanzas)**, desarrollado bajo la arquitectura limpia y modular de Node.js con ES Modules, Express 5 y conectado a PostgreSQL en Supabase.

---

## 🚀 Pila Tecnológica

- **Entorno de Ejecución:** Node.js v24.x con soporte nativo para ES Modules (`"type": "module"`).
- **Framework Web:** Express 5.x.
- **Seguridad HTTP:** `helmet` (encabezados HTTP seguros) y `cors` (control de acceso de orígenes cruzados).
- **Logging:** `morgan` (registro de peticiones HTTP en consola).
- **Base de Datos:** PostgreSQL en Supabase con `pg.Pool` y soporte SSL (`rejectUnauthorized: false`).
- **Autenticación y Criptografía:** JSON Web Tokens (`jsonwebtoken`) y cifrado de contraseñas con `bcryptjs`.
- **Documentación de API:** OpenAPI 3.0 interactivo con `swagger-ui-express` y `swagger-jsdoc`.
- **Auditoría:** Registro centralizado de trazabilidad y eventos críticos en `system_logs`.

---

## 📋 Los 12 Módulos Funcionales

| # | Módulo | Ruta Base | Descripción |
|---|---|---|---|
| **1** | **Tipos de Egresos** | `/api/tipos-egresos` | Catálogo maestro de clasificación de gastos (Gasto, Inversión, Costo, etc.). |
| **2** | **Tipos de Ingresos** | `/api/tipos-ingresos` | Catálogo maestro de fuentes de ingresos (Salario Base, Horas Extras, Comisiones, etc.). |
| **3** | **Renglones de Egresos** | `/api/renglones-egresos` | Clasificaciones presupuestarias (Alimentación, Transporte, Servicios, Salud, Educación). |
| **4** | **Tipos de Pago** | `/api/tipos-pago` | Medios de pago (Efectivo, Tarjeta de Débito, Tarjeta de Crédito, Transferencia, Cheque). |
| **5** | **Conceptos de Egresos** | `/api/conceptos-egresos` | Plantillas de egresos vinculadas a tipo de egreso, renglón presupuestario y forma de pago. |
| **6** | **Conceptos de Ingresos** | `/api/conceptos-ingresos` | Plantillas de ingresos vinculadas a tipo de ingreso e institución o cliente. |
| **7** | **Gestión de Usuarios y Auth** | `/api/usuarios` & `/api/auth` | Registro, login JWT, perfil, cambio de contraseña y CRUD de usuarios con límite de egresos y fecha de corte. |
| **8** | **Registro de Transacciones** | `/api/transacciones` | Registro de movimientos (Ingresos y Egresos) con correlativo `TRX-YYYYMM-XXXXX` y anulación lógica. |
| **9** | **Proceso de Corte Mensual** | `/api/cortes` | Cierre contable mensual: arrastra balance inicial anterior, suma ingresos/egresos y calcula balance al corte. |
| **10** | **Consulta por Criterios** | `/api/consultas` | Búsqueda multidimensional analítica con filtros combinados y totales acumulados en tiempo real. |
| **11** | **Reportes Analíticos** | `/api/reportes` | Reportes consolidados de cortes, desgloses por renglón/tipo, estadísticas de cumplimiento de límites y evolución anual. |
| **12** | **Regla y Alerta de Límite** | `/api/transacciones` & `/api/usuarios/:id/limite-status` | Alerta descriptiva (`warning`) al registrar un egreso que sobrepasa el límite mensual sin bloquear el registro. |

---

## 💡 Reglas de Negocio Clave

### 1. Alerta Preventiva de Límite de Egresos (Requisito 12)
Al registrar una transacción de tipo `EGRESO`:
1. El sistema calcula en tiempo real el consumo acumulado de egresos aplicados dentro del periodo mensual activo del usuario (determinado por su `fecha_corte`).
2. Si el nuevo monto excede el `limite_egresos`:
   - La transacción se registra exitosamente con estado `APLICADA`.
   - La respuesta JSON incluye un bloque `warning`:
     ```json
     {
       "success": true,
       "message": "Transacción registrada exitosamente",
       "data": {
         "transaccion": { ... },
         "warning": {
           "supero_limite": true,
           "limite_egresos": 50000.0,
           "total_egresos_periodo": 52300.0,
           "exceso": 2300.0,
           "porcentaje_consumido": 104.6,
           "mensaje": "Alerta: El egreso registrado ha superado el límite mensual establecido de RD$ 50,000.00 por RD$ 2,300.00 (104.60% consumido)."
         }
       }
     }
     ```

### 2. Proceso de Corte Mensual (Requisito 9)
Para cada periodo mensual de un usuario:
- **Balance Inicial:** Corresponde al `balance_al_corte` del corte mensual inmediatamente anterior (o `0.00` si es el primer corte).
- **Total Ingresos:** Suma de todas las transacciones de tipo `INGRESO` con estado `APLICADA` en el rango del periodo.
- **Total Egresos:** Suma de todas las transacciones de tipo `EGRESO` con estado `APLICADA` en el rango del periodo.
- **Balance al Corte:** `balance_inicial + total_ingresos - total_egresos`.
- **Superó Límite:** `true` si `total_egresos > limite_egresos_periodo` (cuando `limite_egresos_periodo > 0`).

### 3. Generación de Folios Únicos
Cada transacción genera un código correlativo con formato `TRX-YYYYMM-XXXXX` (por ejemplo: `TRX-202609-00001`).

---

## 🛠️ Instalación y Configuración

### 1. Clonar e Instalar Dependencias
```powershell
cd c:\OpenSource2\Backend-FinanzasPersonales
npm install
```

### 2. Configurar Variables de Entorno
Crea el archivo `.env` a partir de `.env.example`:
```powershell
Copy-Item .env.example .env
```

Configura tu cadena de conexión de Supabase en `.env`:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:[TU-PASSWORD]@db.yrxokudwehicfjqsnwwr.supabase.co:5432/postgres
DB_SSL=true
JWT_SECRET=tu_clave_secreta_jwt_aqui
JWT_EXPIRES_IN=7d
```

### 3. Comandos Disponibles

| Comando | Descripción |
|---|---|
| `npm start` | Inicia el servidor en modo producción. |
| `npm run dev` | Inicia el servidor con recarga en caliente (`--watch`). |
| `npm run test:swagger` | Valida automáticamente los esquemas y rutas OpenAPI 3.0. |
| `npm test` | Ejecuta la suite de pruebas E2E integral contra la base de datos. |

---

## 📖 Documentación Interactiva (Swagger UI)

Al levantar el servidor, puedes explorar y probar todos los endpoints desde el navegador en:
- **Swagger UI:** `http://localhost:3000/api-docs`
- **OpenAPI JSON Spec:** `http://localhost:3000/api-docs.json`

---

## 🗄️ Modelo de Base de Datos PostgreSQL

```mermaid
erDiagram
    usuarios ||--o{ transacciones : "registra"
    usuarios ||--o{ cortes_mensuales : "posee"
    tipos_egresos ||--o{ conceptos_egresos : "clasifica"
    renglones_egresos ||--o{ conceptos_egresos : "agrupa"
    tipos_pago ||--o{ conceptos_egresos : "default"
    tipos_ingresos ||--o{ conceptos_ingresos : "clasifica"
    conceptos_egresos ||--o{ transacciones : "motiva_egreso"
    conceptos_ingresos ||--o{ transacciones : "motiva_ingreso"
    tipos_pago ||--o{ transacciones : "medio_pago"

    usuarios {
        uuid id PK
        varchar cedula UK
        varchar nombre
        varchar email UK
        varchar password
        numeric limite_egresos
        varchar tipo_persona
        int fecha_corte
        varchar role
        varchar estado
    }

    transacciones {
        uuid id PK
        varchar numero_transaccion UK
        varchar tipo_transaccion
        uuid usuario_id FK
        uuid concepto_egreso_id FK
        uuid concepto_ingreso_id FK
        uuid tipo_pago_id FK
        date fecha_transaccion
        numeric monto
        varchar estado
    }

    cortes_mensuales {
        uuid id PK
        uuid usuario_id FK
        int anio
        int mes
        date fecha_corte
        numeric balance_inicial
        numeric total_ingresos
        numeric total_egresos
        numeric balance_al_corte
        numeric limite_egresos_periodo
        boolean supero_limite
        varchar estado
    }
```
