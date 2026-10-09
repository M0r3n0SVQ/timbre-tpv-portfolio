-- Activa Row Level Security en todas las tablas y solo deja acceder a
-- usuarios autenticados.
--
-- Por qué: hasta ahora RLS estaba desactivado, así que la clave pública
-- (que va dentro del JavaScript del navegador, por diseño) daba lectura y
-- escritura completas a cualquiera que tuviera la URL de la app. A partir de
-- aquí hace falta haber iniciado sesión con la cuenta del bar.
--
-- ANTES de ejecutarlo:
--   1. Authentication → Users → Add user: crear la cuenta del bar
--      (email + contraseña, marcando "Auto Confirm User").
--   2. Authentication → Sign In / Providers: desactivar "Allow new users to
--      sign up". Si no, cualquiera podría registrarse, quedar "authenticated"
--      y saltarse todo esto.
--   3. Desplegar la versión de la app con pantalla de login y la variable
--      NEXT_PUBLIC_TPV_EMAIL configurada.
--
-- Importante: en cuanto se ejecuta, los móviles sin sesión dejan de ver
-- datos hasta que se inicie sesión en ellos. Ejecútalo con el bar cerrado.
-- No borra ni modifica ningún dato.
--
-- Vuelta atrás (si algo falla): ejecutar
--   2026-10-08-rls-autenticacion.rollback.sql
--
-- Cómo ejecutarlo: Supabase Dashboard → tu proyecto → SQL Editor → pegar
-- todo este archivo → Run. Se puede ejecutar más de una vez sin problema.

do $$
declare
  t text;
begin
  foreach t in array array['cuentas', 'cobros', 'sesiones', 'comandas_servidas', 'lista_compra', 'backups']
  loop
    execute format('alter table %I enable row level security', t);

    -- Sin política para "anon", RLS ya le niega todo; quitarle además los
    -- permisos de tabla hace que falle con un error claro en vez de
    -- devolver listas vacías que parezcan datos perdidos.
    execute format('revoke all on table %I from anon', t);

    execute format('drop policy if exists "solo el bar autenticado" on %I', t);
    execute format(
      'create policy "solo el bar autenticado" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
