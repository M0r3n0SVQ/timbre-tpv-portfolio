"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Sesion } from "@/lib/types";

export function useSesion() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarSesion();

    const channel = supabase
      .channel("sesion-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sesiones" }, cargarSesion)
      .subscribe();

    const poll = setInterval(cargarSesion, 10000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, []);

  async function cargarSesion() {
    const { data } = await supabase
      .from("sesiones")
      .select("*")
      .eq("activa", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSesion(data ?? null);
    setLoading(false);
  }

  async function iniciarTurno(turno: "mañana" | "tarde", cajaInicio: number = 0) {
    const id = `${turno}-${Date.now()}`;
    const fecha = new Date().toDateString();
    const { data } = await supabase
      .from("sesiones")
      .insert({ id, turno, fecha, activa: true, caja_inicio: cajaInicio })
      .select()
      .single();
    if (data) setSesion(data as Sesion);
  }

  async function cerrarTurno() {
    if (!sesion) return;
    await supabase.from("sesiones").update({ activa: false }).eq("id", sesion.id);
    setSesion(null);
  }

  async function actualizarCaja(importe: number) {
    if (!sesion) return;
    setSesion((prev) => prev ? { ...prev, caja_inicio: importe } : prev);
    await supabase.from("sesiones").update({ caja_inicio: importe }).eq("id", sesion.id);
  }

  return { sesion, loading, iniciarTurno, cerrarTurno, actualizarCaja };
}
