-- Filas por tabla de public en JSON. Se compara antes y después de restaurar.
select json_build_object(
  'tablas', coalesce(json_object_agg(table_name, filas order by table_name), '{}'::json)
)
from (
  select
    table_name,
    (xpath('/row/n/text()',
      query_to_xml(format('select count(*) as n from public.%I', table_name), false, true, '')
    ))[1]::text::bigint as filas
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
) t;
