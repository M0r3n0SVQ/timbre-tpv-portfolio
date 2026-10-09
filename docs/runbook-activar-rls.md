# Runbook: activar autenticación y RLS en producción

Cambio: la app pasa a pedir la contraseña del bar (una vez por dispositivo) y la base de datos deja de aceptar peticiones sin sesión.

- **Cuándo:** con el bar cerrado. Hay que tener a mano todos los móviles/tablets que usan el TPV.
- **Duración estimada:** 20–30 min.
- **Requisito:** el mismo procedimiento ya probado en el proyecto de demo.

## 0. Antes de empezar

- [ ] Exportar los datos por si acaso: Supabase → Table Editor → `cobros` → *Export to CSV* (y `cuentas` si hay alguna abierta).
- [ ] Elegir la contraseña del bar y guardarla en un gestor de contraseñas. Que sea larga; solo se escribe una vez por dispositivo.

## 1. Supabase: cuenta del bar y registro cerrado

1. Authentication → Users → **Add user** → *Create new user*: email del bar + contraseña, marcando **Auto Confirm User**.
2. Authentication → Sign In / Providers → desactivar **Allow new users to sign up** → Save.

Hasta aquí la app de producción sigue funcionando igual (RLS aún no está activo).

## 2. Vercel: variable de entorno y despliegue

1. Project → Settings → Environment Variables → añadir `NEXT_PUBLIC_TPV_EMAIL` con el email del paso 1 (entornos *Production* y *Preview*).
2. Fusionar el cambio en `main` y esperar a que el despliegue termine.
3. En cada dispositivo: abrir la app → aparece la pantalla de contraseña → entrar. Comprobar que se ven las cuentas y el turno.

En iPhone con la app instalada en la pantalla de inicio, hay que entrar **desde la app instalada**, no desde Safari: cada una guarda su propia sesión.

## 3. Activar RLS

1. Supabase → SQL Editor → pegar [`supabase/migrations/2026-10-08-rls-autenticacion.sql`](../supabase/migrations/2026-10-08-rls-autenticacion.sql) → **Run**.

## 4. Verificar

- [ ] En dos dispositivos con sesión: crear una cuenta de prueba, añadir un producto y comprobar que aparece en el otro al momento (tiempo real).
- [ ] Marcar un plato como servido en Cocina y comprobar que se ve en el otro dispositivo.
- [ ] Cobrar la cuenta de prueba y borrarla del historial si hace falta.
- [ ] Desde un ordenador, sin sesión, la API debe rechazar la petición (sustituir los valores):

  ```bash
  curl -s "https://TU-PROYECTO.supabase.co/rest/v1/cobros?select=id&limit=1" \
    -H "apikey: TU-PUBLISHABLE-KEY"
  ```

  Resultado esperado: un error `permission denied for table cobros`. Si devuelve datos, RLS no está activo.

## Vuelta atrás

Si al abrir el bar la app no carga datos y no hay tiempo de investigar:

1. SQL Editor → ejecutar [`2026-10-08-rls-autenticacion.rollback.sql`](../supabase/migrations/2026-10-08-rls-autenticacion.rollback.sql). La app vuelve a funcionar al instante (la pantalla de login sigue, pero no estorba: quien ya entró no la vuelve a ver).
2. Investigar con el bar cerrado y volver a aplicar la migración.

La vuelta atrás deja la base de datos expuesta otra vez: es un parche temporal, no una solución.

## Si se filtra la contraseña

1. Authentication → Users → cuenta del bar → **Delete user**, y crearla de nuevo (mismo email) con otra contraseña. Borrar el usuario revoca todas sus sesiones; en como mucho 1 h (lo que dura un token de acceso) nadie con la contraseña antigua tiene acceso.
2. Volver a entrar en cada dispositivo del bar con la nueva.
