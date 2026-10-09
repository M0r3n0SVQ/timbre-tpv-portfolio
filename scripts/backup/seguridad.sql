-- Por cada tabla de public: si tiene RLS activado y si el rol anon (la
-- clave pública) puede leerla. Tras restaurar, debe ser rls=true y
-- anon_lee=false en todas.
select coalesce(json_object_agg(c.relname, json_build_object(
  'rls', c.relrowsecurity,
  'anon_lee', has_table_privilege('anon', c.oid, 'select')
)), '{}'::json)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
