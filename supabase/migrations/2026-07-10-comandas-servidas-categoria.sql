-- Segunda vuelta: añade la categoría a la clave de comandas_servidas.
--
-- Por qué: el precio tampoco bastaba. 6 de los 8 platos que comparten
-- nombre entre Montaditos y Tapas tienen además el MISMO precio en las
-- dos categorías (p.ej. "Lomo orza salmorejo" vale 3.40€ en las dos), así
-- que nombre+precio seguía sin distinguirlos. Con la categoría ya no hay
-- ambigüedad posible.
--
-- Importante: vuelve a vaciar la tabla (mismo motivo que la migración
-- anterior: es estado operativo del día, no se puede reconstruir).
-- Ejecútalo en un momento tranquilo, no en mitad del servicio.
--
-- Requiere haber aplicado antes 2026-07-10-comandas-servidas-precio.sql.
--
-- Cómo ejecutarlo: Supabase Dashboard → tu proyecto → SQL Editor → pegar
-- todo este archivo → Run.

truncate table comandas_servidas;

alter table comandas_servidas
  drop constraint if exists comandas_servidas_pkey;

alter table comandas_servidas
  add column if not exists categoria text not null;

alter table comandas_servidas
  add primary key (cuenta_id, item_nombre, precio, categoria);
