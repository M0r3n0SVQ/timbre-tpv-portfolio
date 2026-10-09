-- Prepara un PostgreSQL vacío (no Supabase) para recibir un backup: crea
-- los roles de Supabase a los que hacen referencia las políticas RLS y los
-- permisos del volcado. Sin ellos, pg_restore falla en el primer GRANT.
--
-- No hace falta en un proyecto de Supabase: esos roles ya existen.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role', 'supabase_admin']
  loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;
