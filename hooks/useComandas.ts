"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ComandaServida = {
  cuenta_id: string;
  item_nombre: string;
  cantidad_servida: number;
};

export function useComandas() {
  const [servidas, setServidas] = useState<ComandaServida[]>([]);

  useEffect(() => {
    fetchServidas();

    const channel = supabase
      .channel("comandas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas_servidas" }, fetchServidas)
      .subscribe();

    const poll = setInterval(fetchServidas, 3000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, []);

  async function fetchServidas() {
    const { data } = await supabase.from("comandas_servidas").select("*");
    if (data) setServidas(data);
  }

  async function guardar(cuentaId: string, itemNombre: string, cantidad: number) {
    // Optimistic update
    setServidas((prev) => {
      const exists = prev.some((s) => s.cuenta_id === cuentaId && s.item_nombre === itemNombre);
      if (exists) return prev.map((s) => s.cuenta_id === cuentaId && s.item_nombre === itemNombre ? { ...s, cantidad_servida: cantidad } : s);
      return [...prev, { cuenta_id: cuentaId, item_nombre: itemNombre, cantidad_servida: cantidad }];
    });

    // DELETE + INSERT: infalible sin importar si la fila existe o no
    await supabase.from("comandas_servidas")
      .delete()
      .eq("cuenta_id", cuentaId)
      .eq("item_nombre", itemNombre);

    await supabase.from("comandas_servidas")
      .insert({ cuenta_id: cuentaId, item_nombre: itemNombre, cantidad_servida: cantidad });

    // Confirmar estado real desde Supabase
    await fetchServidas();
  }

  async function servirUno(cuentaId: string, itemNombre: string) {
    const actual = servidas.find((s) => s.cuenta_id === cuentaId && s.item_nombre === itemNombre)?.cantidad_servida ?? 0;
    await guardar(cuentaId, itemNombre, actual + 1);
  }

  async function servirTodo(cuentaId: string, itemNombre: string, cantidad: number) {
    await guardar(cuentaId, itemNombre, cantidad);
  }

  async function limpiarCuenta(cuentaId: string) {
    setServidas((prev) => prev.filter((s) => s.cuenta_id !== cuentaId));
    await supabase.from("comandas_servidas").delete().eq("cuenta_id", cuentaId);
  }

  return { servidas, servirUno, servirTodo, limpiarCuenta };
}
