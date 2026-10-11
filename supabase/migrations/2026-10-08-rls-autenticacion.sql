-- RLS en todas las tablas: solo entra el usuario autenticado (la cuenta del bar).
-- Antes: crear la cuenta del bar, desactivar el registro público y desplegar la app
-- con login. Con el bar cerrado. Pasos en docs/runbook-activar-rls.md
-- Se puede ejecutar varias veces. Para deshacerla, el .rollback.sql

do $$
declare
  t text;
begin
  foreach t in array array['cuentas', 'cobros', 'sesiones', 'comandas_servidas', 'lista_compra', 'backups']
  loop
    execute format('alter table %I enable row level security', t);

    -- sin permisos da un error claro en vez de devolver listas vacías
    execute format('revoke all on table %I from anon', t);

    execute format('drop policy if exists "solo el bar autenticado" on %I', t);
    execute format(
      'create policy "solo el bar autenticado" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
