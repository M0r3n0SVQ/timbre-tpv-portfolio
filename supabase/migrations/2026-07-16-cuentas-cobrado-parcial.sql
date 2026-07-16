-- Añade el seguimiento de "pagado a cuenta" por importe suelto.
--
-- Por qué: el cobro parcial solo permitía elegir artículos concretos, pero
-- muchas veces un cliente paga un importe suelto ("aquí tienes 50€, el
-- resto luego") que no corresponde a ninguna combinación exacta de líneas.
-- cobrado_parcial guarda cuánto se ha cobrado así; lo que queda pendiente
-- de una cuenta es total - cobrado_parcial.
--
-- Migración aditiva y segura: no vacía ni bloquea la tabla, se puede
-- ejecutar en cualquier momento, incluso en mitad del servicio.
--
-- Cómo ejecutarlo: Supabase Dashboard → tu proyecto → SQL Editor → pegar
-- todo este archivo → Run.

alter table cuentas
  add column if not exists cobrado_parcial numeric(8,2) not null default 0;
