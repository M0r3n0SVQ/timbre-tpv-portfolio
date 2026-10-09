-- Deshace 2026-10-08-rls-autenticacion.sql: vuelve a dejar las tablas
-- abiertas a la clave pública, como estaban antes.
--
-- Solo para emergencias (p. ej. la app no carga datos tras activar RLS y
-- hay que abrir el bar). Deja la base de datos expuesta otra vez: en cuanto
-- se resuelva el problema, vuelve a aplicar la migración.

do $$
declare
  t text;
begin
  foreach t in array array['cuentas', 'cobros', 'sesiones', 'comandas_servidas', 'lista_compra', 'backups']
  loop
    execute format('drop policy if exists "solo el bar autenticado" on %I', t);
    execute format('grant all on table %I to anon', t);
    execute format('alter table %I disable row level security', t);
  end loop;
end $$;
