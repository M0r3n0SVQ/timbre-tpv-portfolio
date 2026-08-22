-- Cuentas abiertas (en curso)
CREATE TABLE cuentas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  items            JSONB NOT NULL DEFAULT '[]',
  total            NUMERIC(8,2) NOT NULL DEFAULT 0,
  -- true = ya se cobró pero sigue pendiente de cocina; se elimina sola en
  -- cuanto no le queda nada pendiente de servir (ver page.tsx).
  pagada           BOOLEAN NOT NULL DEFAULT false,
  -- Dinero ya cobrado "a cuenta" por un importe suelto, no ligado a
  -- artículos concretos (cobro parcial "por importe"). Lo pendiente de
  -- cobrar es total - cobrado_parcial.
  cobrado_parcial  NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cuentas DISABLE ROW LEVEL SECURITY;

-- Cobros realizados (histórico)
CREATE TABLE cobros (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_cuenta TEXT NOT NULL,
  items         JSONB NOT NULL DEFAULT '[]',
  total         NUMERIC(8,2) NOT NULL DEFAULT 0,
  sesion_id     TEXT,
  metodo_pago   TEXT NOT NULL DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'tarjeta')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cobros DISABLE ROW LEVEL SECURITY;

-- Sesión activa (turno en curso, compartida entre dispositivos)
CREATE TABLE sesiones (
  id          TEXT PRIMARY KEY,
  turno       TEXT NOT NULL CHECK (turno IN ('mañana', 'tarde')),
  fecha       TEXT NOT NULL,
  activa      BOOLEAN NOT NULL DEFAULT true,
  caja_inicio NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sesiones DISABLE ROW LEVEL SECURITY;

-- Ítems de cocina ya servidos (para la pantalla de cocina)
CREATE TABLE comandas_servidas (
  cuenta_id        TEXT NOT NULL,
  item_nombre      TEXT NOT NULL,
  -- Varios platos comparten nombre Y precio entre categorías (p.ej. "Lomo
  -- orza salmorejo" vale 3.40€ tanto en Montaditos como en Tapas): sin
  -- precio+categoria en la clave, servir uno marcaba también el otro.
  precio           NUMERIC(8,2) NOT NULL,
  categoria        TEXT NOT NULL,
  cantidad_servida INT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cuenta_id, item_nombre, precio, categoria)
);

ALTER TABLE comandas_servidas DISABLE ROW LEVEL SECURITY;

-- Lista de la compra compartida (una sola fila, id fijo "unica")
CREATE TABLE lista_compra (
  id         TEXT PRIMARY KEY,
  items      JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lista_compra DISABLE ROW LEVEL SECURITY;

-- Copia de seguridad automática del día (una sola fila, id fijo "ultimo")
CREATE TABLE backups (
  id         TEXT PRIMARY KEY,
  datos      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE backups DISABLE ROW LEVEL SECURITY;
