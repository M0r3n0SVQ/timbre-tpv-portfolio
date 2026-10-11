-- Por tabla: si tiene RLS y si anon puede leerla. Debe ser rls=true, anon_lee=false.
select coalesce(json_object_agg(c.relname, json_build_object(
  'rls', c.relrowsecurity,
  'anon_lee', has_table_privilege('anon', c.oid, 'select')
)), '{}'::json)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
