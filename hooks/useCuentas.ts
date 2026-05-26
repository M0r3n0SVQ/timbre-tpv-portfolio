"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Cuenta, Item } from "@/lib/types";

export function useCuentas() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const { data, error } = await supabase
      .from("cuentas")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setCuentas(data ?? []);
    setLoading(false);
  }

  async function crearCuenta(nombre: string) {
    const { data, error } = await supabase
      .from("cuentas")
      .insert({ nombre, items: [], total: 0 })
      .select()
      .single();
    if (error) { setError(error.message); return null; }
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
      setError(error.message);
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
    if (error) { setError(error.message); fetchCuentas(); return false; }
    return true;
  }

  async function eliminarCuenta(id: string) {
    setCuentas((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from("cuentas").delete().eq("id", id);
    if (error) { setError(error.message); fetchCuentas(); return false; }
    return true;
  }

  return { cuentas, loading, error, crearCuenta, actualizarCuenta, renombrarCuenta, eliminarCuenta, refetch: fetchCuentas };
}
