-- Deshace la migración de RLS. Solo para emergencias: deja la BD abierta otra vez.

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
