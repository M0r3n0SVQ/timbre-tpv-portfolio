-- Cuentas abiertas (en curso)
CREATE TABLE cuentas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  items      JSONB NOT NULL DEFAULT '[]',
  total      NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cuentas DISABLE ROW LEVEL SECURITY;

-- Cobros realizados (histórico)
CREATE TABLE cobros (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_cuenta TEXT NOT NULL,
  items         JSONB NOT NULL DEFAULT '[]',
  total         NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cobros DISABLE ROW LEVEL SECURITY;

-- Sesión activa (turno en curso, compartida entre dispositivos)
CREATE TABLE sesiones (
  id         TEXT PRIMARY KEY,
  turno      TEXT NOT NULL CHECK (turno IN ('mañana', 'tarde')),
  fecha      TEXT NOT NULL,
  activa     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sesiones DISABLE ROW LEVEL SECURITY;
