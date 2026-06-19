"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Cierre } from "@/lib/types";

export function useCierres() {
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [loadingCierres, setLoadingCierres] = useState(false);

  async function fetchCierres() {
    setLoadingCierres(true);
    const { data } = await supabase
      .from("cierres")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setCierres(data as Cierre[]);
    setLoadingCierres(false);
  }

  async function guardarCierre(cierre: Omit<Cierre, "id" | "created_at">) {
    const { data, error } = await supabase
      .from("cierres")
      .insert(cierre)
      .select()
      .single();
    if (!error && data) {
      setCierres((prev) => [data as Cierre, ...prev]);
      return data as Cierre;
    }
    return null;
  }

  async function eliminarCierre(id: string) {
    setCierres((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("cierres").delete().eq("id", id);
  }

  return { cierres, loadingCierres, guardarCierre, fetchCierres, eliminarCierre };
}
