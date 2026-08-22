-- Añade el método de pago (efectivo/tarjeta) a cada cobro.
--
-- Por qué: hasta ahora el histórico no distinguía cómo se había pagado
-- cada cuenta, así que no se podía cuadrar caja de efectivo frente a lo
-- cobrado por datáfono. Se elige al cobrar (por defecto "efectivo") y
-- queda guardado junto al resto del recibo.
--
-- Migración aditiva y segura: no vacía ni bloquea la tabla, se puede
-- ejecutar en cualquier momento, incluso en mitad del servicio. Los cobros
-- ya existentes quedan como "efectivo" (valor por defecto).
--
-- Cómo ejecutarlo: Supabase Dashboard → tu proyecto → SQL Editor → pegar
-- todo este archivo → Run.

alter table cobros
  add column if not exists metodo_pago text not null default 'efectivo';

-- Postgres no soporta "ADD CONSTRAINT IF NOT EXISTS", así que se comprueba a mano.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cobros_metodo_pago_check'
  ) then
    alter table cobros
      add constraint cobros_metodo_pago_check check (metodo_pago in ('efectivo', 'tarjeta'));
  end if;
end $$;
