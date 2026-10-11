-- Crea los roles de Supabase en un PostgreSQL normal para poder restaurar ahí
-- (si no, falla en el primer GRANT). En Supabase no hace falta.
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
