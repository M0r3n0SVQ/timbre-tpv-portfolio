# Timbre TPV

TPV web para Cervecería El Timbre. Next.js + Supabase, pensado para varios camareros a la vez desde el móvil.

Documentación técnica completa (arquitectura, base de datos, decisiones de diseño): [ARCHITECTURE.md](./ARCHITECTURE.md).

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Necesita un archivo `.env.local` con las credenciales de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-anon-key
```

El esquema de la base de datos está en [supabase/schema.sql](./supabase/schema.sql).

## Deploy

Vercel, auto-deploy en cada push a `main`.
