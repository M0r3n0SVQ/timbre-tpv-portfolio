"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Cobro, Cuenta, Item, MetodoPago } from "@/lib/types";
import type { HookError } from "@/hooks/useCuentas";

export function useCobros() {
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);
  const errorSeq = useRef(0);
  function reportError(message: string) {
    errorSeq.current += 1;
    setError({ message, id: errorSeq.current });
  }

  useEffect(() => {
    fetchCobros();

    const channel = supabase
      .channel("cobros-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "cobros" }, () => {
        fetchCobros();
      })
      .subscribe();

    const poll = setInterval(fetchCobros, 5000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, []);

  async function fetchCobros() {
    setLoading(true);
    // Día de bar: desde las 6:00 AM (si son menos de las 6, el día empezó ayer)
    const inicio = new Date();
    if (inicio.getHours() < 6) inicio.setDate(inicio.getDate() - 1);
    inicio.setHours(6, 0, 0, 0);
    const { data, error } = await supabase
      .from("cobros")
      .select("*")
      .gte("created_at", inicio.toISOString())
      .order("created_at", { ascending: true });
    // Fallos del polling/realtime en segundo plano no generan aviso (se
    // reintenta solo cada 5s); solo se avisa de fallos en acciones directas
    // del usuario, ahí abajo.
    if (!error) setCobros(data ?? []);
    setLoading(false);
  }

  async function cobrarCuenta(cuenta: Cuenta, sesionId: string, itemsACobrar?: Item[], totalOverride?: number, metodoPago: MetodoPago = "efectivo") {
    const items = itemsACobrar ?? cuenta.items;
    // totalOverride: para cobrar solo lo pendiente cuando ya se ha cobrado
    // parte de la cuenta por un importe suelto (cobrado_parcial), sin perder
    // el desglose de artículos real en el recibo.
    const total = totalOverride ?? items.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const { data, error } = await supabase
      .from("cobros")
      .insert({
        nombre_cuenta: cuenta.nombre,
        items,
        total,
        sesion_id: sesionId,
        metodo_pago: metodoPago,
      })
      .select()
      .single();
    if (error) { reportError(`No se pudo guardar el cobro de "${cuenta.nombre}": ${error.message}`); return null; }
    setCobros((prev) => [...prev, data as Cobro]);
    return data as Cobro;
  }

  async function actualizarMetodoPago(id: string, metodoPago: MetodoPago) {
    const { error } = await supabase.from("cobros").update({ metodo_pago: metodoPago }).eq("id", id);
    if (error) { reportError(`No se pudo cambiar el método de pago: ${error.message}`); return false; }
    setCobros((prev) => prev.map((c) => (c.id === id ? { ...c, metodo_pago: metodoPago } : c)));
    return true;
  }

  async function cerrarDia() {
    const inicio = new Date();
    if (inicio.getHours() < 6) inicio.setDate(inicio.getDate() - 1);
    inicio.setHours(6, 0, 0, 0);
    const { error } = await supabase.from("cobros").delete().gte("created_at", inicio.toISOString());
    if (error) { reportError(`No se pudo cerrar el día: ${error.message}`); return false; }
    setCobros([]);
    return true;
  }

  async function restaurarCobros(cobrosBackup: Cobro[]) {
    // upsert por id (no insert): si el cobro ya existe en la base de datos
    // (p.ej. al pulsar "Restaurar" más de una vez) se sobreescribe en vez de
    // duplicarse. Antes esto insertaba una fila nueva cada vez y doblaba
    // el total del día.
    let fallos = 0;
    for (const c of cobrosBackup) {
      const { error } = await supabase.from("cobros").upsert({
        id: c.id,
        nombre_cuenta: c.nombre_cuenta,
        items: c.items,
        total: c.total,
        sesion_id: c.sesion_id,
        created_at: c.created_at,
        metodo_pago: c.metodo_pago ?? "efectivo",
      }, { onConflict: "id" });
      if (error) fallos++;
    }
    if (fallos > 0) reportError(`No se pudieron restaurar ${fallos} cobro${fallos !== 1 ? "s" : ""} de la copia de seguridad.`);
    await fetchCobros();
  }

  return { cobros, loading, error, cobrarCuenta, actualizarMetodoPago, cerrarDia, restaurarCobros, refetch: fetchCobros };
}
