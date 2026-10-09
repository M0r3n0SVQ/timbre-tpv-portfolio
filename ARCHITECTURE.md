# Timbre TPV — Documentación técnica

TPV (Terminal Punto de Venta) web para **Cervecería El Timbre**. App móvil-first pensada para que varios camareros operen simultáneamente desde sus teléfonos, con sincronización en tiempo real y una pantalla de cocina.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 |
| Base de datos | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime (`postgres_changes`) + polling |
| Auth | Supabase Auth (email + contraseña) + RLS |
| Tests | Vitest |
| CI | GitHub Actions (lint, tests, build) |
| Deploy | Vercel (auto-deploy en push a `main`) |
| PWA | `manifest.ts` + `apple-touch-icon` + viewport `cover` |

---

## Arquitectura general

```
┌─────────────────────────────────────────┐
│              Vercel (CDN)               │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Next.js App Router               │  │
│  │                                   │  │
│  │  app/                             │  │
│  │  ├── layout.tsx   PWA metadata    │  │
│  │  ├── manifest.ts  Web App Manifest│  │
│  │  └── page.tsx     UI única (SPA)  │  │
│  │                                   │  │
│  │  hooks/                           │  │
│  │  ├── useCuentas.ts                │  │
│  │  ├── useCobros.ts                 │  │
│  │  ├── useSesion.ts                 │  │
│  │  └── useComandas.ts               │  │
│  │                                   │  │
│  │  lib/                             │  │
│  │  ├── supabase.ts  cliente global  │  │
│  │  ├── types.ts     tipos compartidos│ │
│  │  ├── carta.ts     productos/precios│ │
│  │  ├── cocina.ts    lógica de cocina │ │
│  │  └── itemIdentity.ts               │ │
│  └───────────────────────────────────┘  │
└────────────────────┬────────────────────┘
                     │ HTTPS (REST) + WebSocket (Realtime)
┌────────────────────▼────────────────────┐
│              Supabase                   │
│                                         │
│  PostgreSQL                             │
│  ├── cuentas          (abiertas)        │
│  ├── cobros           (histórico)       │
│  ├── sesiones         (turno activo)    │
│  ├── comandas_servidas (cocina)         │
│  ├── lista_compra     (fila única)      │
│  └── backups          (fila única)      │
│                                         │
│  Realtime: postgres_changes publication │
└─────────────────────────────────────────┘
```

No hay backend propio: Vercel solo sirve el HTML/JS compilado y el navegador habla **directamente** con Supabase (API REST autogenerada por PostgREST + Realtime por WebSocket) usando `@supabase/supabase-js` y la clave pública (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Las variables `NEXT_PUBLIC_*` se incrustan en el bundle durante el build, así que son públicas por diseño.

La app es una **SPA de una sola página** (`app/page.tsx`, componente cliente). No hay routing — todo el estado vive en React con `useState`. Los modales se superponen sobre la vista principal.

---

## Base de datos

El esquema completo está en [`supabase/schema.sql`](./supabase/schema.sql); los cambios posteriores, en [`supabase/migrations/`](./supabase/migrations/) (cada archivo explica el porqué del cambio y si es seguro aplicarlo en mitad del servicio).

### `cuentas`
Cuentas abiertas en este momento. Se borran al cobrar, salvo que les queden artículos de cocina (Montaditos/Tapas) pendientes de servir — en ese caso se marca `pagada = true` en vez de borrarse, para que la pantalla de Cocina la siga mostrando hasta que se sirva todo. Un `useEffect` en `page.tsx` la borra sola en cuanto no le queda nada pendiente.

`cobrado_parcial` lleva la cuenta del dinero ya cobrado por un importe suelto (cobro parcial "por importe"). Lo pendiente de cobrar siempre es `total - cobrado_parcial`, calculado en el cliente, nunca guardado como columna aparte para no desincronizarse.

```sql
CREATE TABLE cuentas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  items           JSONB NOT NULL DEFAULT '[]',  -- Item[]
  total           NUMERIC(8,2) NOT NULL DEFAULT 0,
  pagada          BOOLEAN NOT NULL DEFAULT false,
  cobrado_parcial NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`items` es un array JSONB con la forma `[{ nombre, precio, cantidad, added_at?, categoria? }]`. El total se recalcula en el cliente y se persiste junto con los items. `added_at` marca cuándo se pidió esa línea por última vez y ordena la cola de la pantalla de Cocina (FIFO).

### `cobros`
Histórico inmutable. Cada vez que se cobra una cuenta (entera o parcial), se inserta aquí. `metodo_pago` guarda cómo se pagó (`efectivo` o `tarjeta`).

```sql
CREATE TABLE cobros (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_cuenta TEXT NOT NULL,
  items         JSONB NOT NULL DEFAULT '[]',
  total         NUMERIC(8,2) NOT NULL DEFAULT 0,
  sesion_id     TEXT,
  metodo_pago   TEXT NOT NULL DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'tarjeta')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `sesiones`
Turno activo (mañana/tarde) compartido entre dispositivos. Se cierra explícitamente con "Cerrar turno". Dentro del mismo **día de bar** (de 6:00 a 6:00) no expira al cruzar la medianoche, para que las cuentas de madrugada no caigan en el día siguiente. Si nadie lo cierra y se pasa al siguiente día de bar, `useSesion` deja de considerarlo activo y lo cierra en segundo plano.

```sql
CREATE TABLE sesiones (
  id          TEXT PRIMARY KEY,  -- "{turno}-{timestamp}"
  turno       TEXT NOT NULL CHECK (turno IN ('mañana', 'tarde')),
  fecha       TEXT NOT NULL,
  activa      BOOLEAN NOT NULL DEFAULT true,
  caja_inicio NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `comandas_servidas`
Seguimiento de ítems de cocina ya servidos. Clave compuesta `(cuenta_id, item_nombre, precio, categoria)`: varios platos de la carta comparten nombre **y** precio entre categorías (p. ej. "Lomo orza salmorejo" vale 3,40 € tanto en Montaditos como en Tapas), así que sin la categoría en la clave, servir uno marcaba también el otro (ver *Incidente* más abajo). Al cobrar o borrar una cuenta, o al quitar una línea del ticket, se limpian sus entradas para que un `cantidad_servida` huérfano no oculte un pedido repetido.

La identidad de un ítem dentro de una cuenta se calcula siempre con `claveItem(nombre, precio, categoria)` (`lib/itemIdentity.ts`).

```sql
CREATE TABLE comandas_servidas (
  cuenta_id        TEXT NOT NULL,
  item_nombre      TEXT NOT NULL,
  precio           NUMERIC(8,2) NOT NULL,
  categoria        TEXT NOT NULL,
  cantidad_servida INT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cuenta_id, item_nombre, precio, categoria)
);
```

### `lista_compra`
Checklist de la compra compartida entre dispositivos. Una única fila con `id = "unica"` (upsert), con caché inmediata en `localStorage`.

### `backups`
Instantánea automática de `cuentas` + `cobros` del día, restaurable desde el Historial. Una única fila con `id = "ultimo"`, sobrescrita con debounce de 8 s. Restaurar usa `upsert` por `id` en `cobros`, así que restaurar dos veces no duplica cobros.

> Esto protege frente a errores de uso (borrar una cuenta por accidente), **no** es un backup de la base de datos: vive en la misma BD. Los backups externos con restauración probada están en el roadmap.

---

## Hooks y sincronización

Cada dominio tiene su propio hook con el patrón **estado local → Supabase Realtime → polling de respaldo**:

| Hook | Responsabilidad |
|---|---|
| `useCuentas` | CRUD de `cuentas`. Actualización optimista; si la escritura falla, rollback recargando. |
| `useCobros` | Solo inserción (los cobros no se editan). |
| `useSesion` | Turno activo del día de bar actual; cierra turnos olvidados de días anteriores. |
| `useComandas` | Ítems servidos en cocina. DELETE + INSERT encolados en una promesa encadenada para que dos "servir" casi simultáneos no se crucen. Polling de 3 s. |

1. **Realtime** (`postgres_changes`): notificación inmediata por WebSocket.
2. **Polling**: si el canal Realtime no dispara (p. ej. una tabla fuera de la publicación `supabase_realtime`), el estado converge en 3–5 s.

---

## Seguridad

### Modelo de claves de Supabase

| Clave | Quién la usa | Privilegios |
|---|---|---|
| Publishable / `anon` key | El navegador | Los que permita RLS |
| `service_role` / secret key | Solo un servidor de confianza | Total, ignora RLS |

La clave pública va en el bundle de JavaScript por diseño: la seguridad no viene de ocultarla, sino de las políticas **RLS** (Row Level Security) de PostgreSQL. Este repositorio no contiene ninguna clave; se configuran como variables de entorno (ver `.env.example`). CORS no sirve como protección: solo lo aplican los navegadores y la Data API de Supabase no permite restringir orígenes.

### Autenticación y RLS

Todas las tablas tienen **RLS activado** con una única política: solo el rol `authenticated` puede leer y escribir. Al rol `anon` además se le retiran los permisos de tabla, así que una petición con solo la clave pública falla con un error de permisos (ver [`supabase/migrations/2026-10-08-rls-autenticacion.sql`](./supabase/migrations/2026-10-08-rls-autenticacion.sql)).

Hay **una sola cuenta del bar**, creada a mano en Supabase, y el registro público está desactivado (si no lo estuviera, cualquiera podría crearse una cuenta y pasar a ser `authenticated`).

El diseño prioriza no interrumpir el servicio:

- La pantalla de login solo pide la contraseña (el email viene de `NEXT_PUBLIC_TPV_EMAIL`) y se ve **una vez por dispositivo**.
- `supabase-js` guarda la sesión en el dispositivo y renueva el token de acceso (1 h) automáticamente. Un fallo de red al renovar no cierra la sesión: solo se pierde si Supabase la rechaza de verdad (p. ej. si se borra la cuenta).
- No hay botón de cerrar sesión, para que nadie la cierre sin querer en mitad del turno.
- `useAuth` solo expone *si* hay sesión, no el objeto `Session`: la renovación del token no vuelve a montar la interfaz.
- Si la sesión se pierde, no se pierde nada: cuentas, cobros y turno están en la base de datos y reaparecen al volver a entrar.

Si la contraseña se filtra: se borra y se vuelve a crear la cuenta del bar con otra contraseña (eso revoca todas sus sesiones) y se inicia sesión de nuevo en los dispositivos del bar. Procedimiento completo en [`docs/runbook-activar-rls.md`](./docs/runbook-activar-rls.md).

Historia: la primera versión no tenía autenticación y las tablas tenían RLS desactivado (riesgo aceptado mientras el uso era interno). Se corrigió desarrollando y probando el cambio contra un proyecto de Supabase de demo antes de aplicarlo a producción con el bar cerrado, con una migración de vuelta atrás preparada.

---

## Estructura de la UI

```
┌─────────────────────────────────┐
│ HEADER                          │
│  Fila 1: Logo · Turno · Cocina · Historial │
│  Fila 2: [Dropdown cuentas] [Rápido] [Compra] │
├─────────────────────────────────┤
│  Vista móvil: "carta" o "ticket"│
│  CARTA: categorías + productos  │
│  TICKET: items de cuenta activa │
├─────────────────────────────────┤
│ FOOTER (tabs móvil)             │
│  [Carta]          [Ticket]      │
└─────────────────────────────────┘

Modales (BottomSheet): cobrar, parcial, dividir, cambio, historial,
libre, ticket, cobro-rápido, lista-compra, juntar, cocina
```

---

## Funcionalidades

| Feature | Descripción |
|---|---|
| Cuentas múltiples | Crear, renombrar, borrar, juntar cuentas |
| Carta por categorías | Tabs horizontales, añadir/quitar productos, importe libre |
| Cobro | Completo, parcial (por artículos o por importe), dividido entre N, cálculo de cambio |
| Método de pago | Efectivo o tarjeta, con desglose de caja |
| Cobro rápido | Consumos rápidos sin cuenta asignada |
| Turnos | Mañana/tarde compartidos entre dispositivos, caja de inicio |
| Historial | Cobros agrupados por turno, con ticket |
| Pantalla de cocina | Tapas/montaditos pendientes, orden FIFO global, servir uno a uno o todo |
| Lista de compra | Checklist compartida |
| Copia del día | Autoguardado restaurable desde el Historial |
| PWA | Instalable en iOS/Android, pantalla completa, safe areas |

---

## Incidente: platos homónimos entre categorías

**Síntoma:** en cocina, servir "Lomo orza salmorejo" de Montaditos marcaba también como servido el de Tapas, y en el ticket ambos se fusionaban en una sola línea.

**Causa:** la identidad de un ítem se comparaba solo por nombre (después, nombre + precio) en cuatro sitios distintos de `page.tsx`, y la clave de `comandas_servidas` tampoco incluía la categoría. Seis de los ocho platos repetidos tenían además el mismo precio.

**Corrección:**
- Identidad única `claveItem(nombre, precio, categoria)` en `lib/itemIdentity.ts`, usada en todos los sitios.
- Migraciones que añaden `precio` y `categoria` a la clave primaria de `comandas_servidas`.
- Lógica de cocina extraída a `lib/cocina.ts` para poder testearla.

**Prevención:** tests con Vitest que cubren el caso exacto del incidente y CI en GitHub Actions (lint + tests + build) en cada push y PR.

---

## Tests y CI

```bash
npm test
```

- `lib/itemIdentity.test.ts` — identidad de un plato dentro de una cuenta.
- `lib/cocina.test.ts` — cálculo de pendientes de cocina, incluido el caso del incidente.

GitHub Actions (`.github/workflows/ci.yml`) se ejecuta en cada push y PR a `main`, con permisos de solo lectura:

1. `npm audit --omit=dev --audit-level=high` — **bloqueante**: una vulnerabilidad alta o crítica en dependencias que llegan a producción para el pipeline.
2. `npm audit --audit-level=high` — informativo para dependencias de desarrollo, que no se despliegan. Hoy reporta una cadena de `eslint-config-next` → `fast-glob` → `micromatch` → `braces` cuyo único arreglo propuesto por npm es bajar a Next 14; se acepta hasta que haya versión corregida.
3. `npm run lint`, `npm test` y `npm run build` (que incluye el chequeo de tipos).

Dependabot (`.github/dependabot.yml`) abre cada lunes un PR agrupado con las actualizaciones menores y de parche, y PRs separados para las mayores y para las GitHub Actions.

---

## Decisiones técnicas

**¿Por qué una sola página en vez de routing?**
Un TPV de bar necesita transiciones instantáneas. Todo el estado vive en memoria y los modales se superponen.

**¿Por qué JSONB para los items en vez de una tabla relacional?**
Los items de una cuenta cambian constantemente. Con JSONB, actualizar una cuenta es una sola operación atómica; una tabla relacional implicaría varias escrituras por cada toque en la carta.

**¿Por qué polling además de Realtime?**
Las tablas creadas a mano pueden no estar en la publicación `supabase_realtime`. El polling garantiza convergencia sin depender de esa configuración.

**¿Por qué DELETE + INSERT en `comandas_servidas`?**
El cliente JS de Supabase se comportaba de forma inconsistente con `upsert` sobre claves compuestas. DELETE + INSERT es explícito, y las llamadas se encolan para evitar carreras.

**¿Por qué se persiste el total si se calcula en el cliente?**
Para poder ordenar y filtrar por importe en SQL sin expandir el JSONB.
