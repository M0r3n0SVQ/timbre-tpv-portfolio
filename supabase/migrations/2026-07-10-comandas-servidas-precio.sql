-- Añade el precio a la clave de comandas_servidas.
--
-- Por qué: varios platos de la carta comparten nombre entre categorías
-- (p.ej. "Queso" existe en Montaditos a 3.20€ y en Tapas a 3.00€). La clave
-- anterior (cuenta_id, item_nombre) no distinguía entre los dos, así que
-- servir uno marcaba también el otro como servido sin haberlo preparado.
--
-- Importante: esto vacía la tabla. No se puede reconstruir con qué precio
-- se sirvió cada fila ya existente, y de todas formas es estado operativo
-- del día (se regenera solo según se va sirviendo). Ejecútalo en un
-- momento tranquilo, no en mitad del servicio — las cuentas abiertas en
-- ese momento perderán las marcas de "ya servido" que tuvieran y habrá
-- que volver a marcarlas.
--
-- Cómo ejecutarlo: Supabase Dashboard → tu proyecto → SQL Editor → pegar
-- todo este archivo → Run.

truncate table comandas_servidas;

alter table comandas_servidas
  drop constraint if exists comandas_servidas_pkey;

alter table comandas_servidas
  add column if not exists precio numeric(8,2) not null;

alter table comandas_servidas
  add primary key (cuenta_id, item_nombre, precio);
