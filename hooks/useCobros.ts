"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Cobro, Cuenta, Item } from "@/lib/types";

export function useCobros() {
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const { data, error } = await supabase
      .from("cobros")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setCobros(data ?? []);
    setLoading(false);
  }

  async function cobrarCuenta(cuenta: Cuenta, sesionId: string, itemsACobrar?: Item[]) {
    const items = itemsACobrar ?? cuenta.items;
    const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const { data, error } = await supabase
      .from("cobros")
      .insert({
        nombre_cuenta: cuenta.nombre,
        items,
        total,
        sesion_id: sesionId,
      })
      .select()
      .single();
    if (error) { setError(error.message); return null; }
    setCobros((prev) => [...prev, data as Cobro]);
    return data as Cobro;
  }

  async function cerrarDia() {
    const { error } = await supabase.from("cobros").delete().not("id", "is", null);
    if (error) { setError(error.message); return false; }
    setCobros([]);
    return true;
  }

  async function restaurarCobros(cobrosBackup: Cobro[]) {
    for (const c of cobrosBackup) {
      await supabase.from("cobros").insert({
        nombre_cuenta: c.nombre_cuenta,
        items: c.items,
        total: c.total,
        sesion_id: c.sesion_id,
        created_at: c.created_at,
      });
    }
    await fetchCobros();
  }

  return { cobros, loading, error, cobrarCuenta, cerrarDia, restaurarCobros, refetch: fetchCobros };
}
