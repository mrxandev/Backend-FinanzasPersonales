CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedula VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  limite_egresos NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (limite_egresos >= 0),
  tipo_persona VARCHAR(20) NOT NULL DEFAULT 'FISICA' CHECK (tipo_persona IN ('FISICA', 'JURIDICA')),
  fecha_corte INT NOT NULL DEFAULT 1 CHECK (fecha_corte BETWEEN 1 AND 31),
  role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO', 'SUSPENDIDO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tipos_egresos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion VARCHAR(100) UNIQUE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tipos_ingresos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion VARCHAR(100) UNIQUE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS renglones_egresos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion VARCHAR(100) UNIQUE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tipos_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion VARCHAR(100) UNIQUE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conceptos_egresos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_egreso_id UUID NOT NULL REFERENCES tipos_egresos(id) ON DELETE RESTRICT,
  renglon_egreso_id UUID NOT NULL REFERENCES renglones_egresos(id) ON DELETE RESTRICT,
  tipo_pago_defecto_id UUID REFERENCES tipos_pago(id) ON DELETE SET NULL,
  descripcion VARCHAR(150) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conceptos_ingresos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_ingreso_id UUID NOT NULL REFERENCES tipos_ingresos(id) ON DELETE RESTRICT,
  descripcion VARCHAR(150) NOT NULL,
  institucion VARCHAR(150),
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_transaccion VARCHAR(30) UNIQUE NOT NULL,
  tipo_transaccion VARCHAR(20) NOT NULL CHECK (tipo_transaccion IN ('INGRESO', 'EGRESO')),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  concepto_egreso_id UUID REFERENCES conceptos_egresos(id) ON DELETE SET NULL,
  concepto_ingreso_id UUID REFERENCES conceptos_ingresos(id) ON DELETE SET NULL,
  tipo_pago_id UUID REFERENCES tipos_pago(id) ON DELETE SET NULL,
  fecha_transaccion DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  numero_tarjeta_credito VARCHAR(20),
  comentario TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'APLICADA' CHECK (estado IN ('APLICADA', 'PENDIENTE', 'ANULADA')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortes_mensuales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  anio INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  fecha_corte DATE NOT NULL,
  balance_inicial NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_ingresos NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_egresos NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  balance_al_corte NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  limite_egresos_periodo NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  supero_limite BOOLEAN NOT NULL DEFAULT false,
  estado VARCHAR(20) NOT NULL DEFAULT 'CERRADO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, anio, mes)
);

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de optimización
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);
CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON usuarios(estado);
CREATE INDEX IF NOT EXISTS idx_transacciones_usuario ON transacciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_fecha ON transacciones(fecha_transaccion);
CREATE INDEX IF NOT EXISTS idx_transacciones_tipo ON transacciones(tipo_transaccion);
CREATE INDEX IF NOT EXISTS idx_transacciones_estado ON transacciones(estado);
CREATE INDEX IF NOT EXISTS idx_cortes_usuario_periodo ON cortes_mensuales(usuario_id, anio, mes);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
