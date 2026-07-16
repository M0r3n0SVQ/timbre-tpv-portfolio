"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Cuenta, Item } from "@/lib/types";

export type HookError = { message: string; id: number };

export function useCuentas() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  // id incremental para que dos errores seguidos con el mismo mensaje (p.ej.
  // "Failed to fetch" repetido) sigan disparando el aviso en pantalla cada vez.
  const [error, setError] = useState<HookError | null>(null);
  const errorSeq = useRef(0);
  function reportError(message: string) {
    errorSeq.current += 1;
    setError({ message, id: errorSeq.current });
  }

  useEffect(() => {
    fetchCuentas();

    const channel = supabase
      .channel("cuentas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "cuentas" }, () => {
        fetchCuentas();
      })
      .subscribe();

    const poll = setInterval(fetchCuentas, 5000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, []);

  async function fetchCuentas() {
    setLoading(true);
    const inicio = new Date();
    if (inicio.getHours() < 6) inicio.setDate(inicio.getDate() - 1);
    inicio.setHours(6, 0, 0, 0);
    const { data, error } = await supabase
      .from("cuentas")
      .select("*")
      .gte("created_at", inicio.toISOString())
      .order("created_at", { ascending: true });
    // No se avisa con un toast por fallos del polling/realtime en segundo
    // plano (se reintenta solo cada 5s); solo se avisa de fallos en acciones
    // directas del usuario (crear/actualizar/cobrar…), ahí abajo.
    if (!error) setCuentas(data ?? []);
    setLoading(false);
  }

  async function crearCuenta(nombre: string) {
    const { data, error } = await supabase
      .from("cuentas")
      .insert({ nombre, items: [], total: 0 })
      .select()
      .single();
    if (error) { reportError(error.message); return null; }
    setCuentas((prev) => [...prev, data as Cuenta]);
    return data as Cuenta;
  }

  async function actualizarCuenta(id: string, items: Item[]) {
    const total = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);

    setCuentas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, items, total } : c))
    );

    const { data, error } = await supabase
      .from("cuentas")
      .update({ items, total })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      reportError(error.message);
      fetchCuentas();
      return null;
    }
    setCuentas((prev) =>
      prev.map((c) => (c.id === id ? (data as Cuenta) : c))
    );
    return data as Cuenta;
  }

  async function renombrarCuenta(id: string, nombre: string) {
    setCuentas((prev) => prev.map((c) => (c.id === id ? { ...c, nombre } : c)));
    const { error } = await supabase.from("cuentas").update({ nombre }).eq("id", id);
    if (error) { reportError(error.message); fetchCuentas(); return false; }
    return true;
  }

  async function eliminarCuenta(id: string) {
    setCuentas((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from("cuentas").delete().eq("id", id);
    if (error) { reportError(error.message); fetchCuentas(); return false; }
    return true;
  }

  async function marcarPagada(id: string) {
    setCuentas((prev) => prev.map((c) => c.id === id ? { ...c, pagada: true } : c));
    const { error } = await supabase.from("cuentas").update({ pagada: true }).eq("id", id);
    if (error) { reportError(error.message); fetchCuentas(); return false; }
    return true;
  }

  // Suma `importe` al dinero ya cobrado "a cuenta" (cobro parcial por
  // importe suelto, no ligado a artículos). Lo pendiente de la cuenta pasa
  // a ser total - cobrado_parcial.
  async function abonarCuenta(id: string, importe: number) {
    const nuevo = (cuentas.find((c) => c.id === id)?.cobrado_parcial ?? 0) + importe;
    setCuentas((prev) => prev.map((c) => c.id === id ? { ...c, cobrado_parcial: nuevo } : c));
    const { error } = await supabase.from("cuentas").update({ cobrado_parcial: nuevo }).eq("id", id);
    if (error) { reportError(error.message); fetchCuentas(); return false; }
    return true;
  }

  return { cuentas, loading, error, crearCuenta, actualizarCuenta, renombrarCuenta, eliminarCuenta, marcarPagada, abonarCuenta, refetch: fetchCuentas };
}
