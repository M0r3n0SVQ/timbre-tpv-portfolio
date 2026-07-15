"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Sesion } from "@/lib/types";
import type { HookError } from "@/hooks/useCuentas";

export function useSesion() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);
  const errorSeq = useRef(0);
  function reportError(message: string) {
    errorSeq.current += 1;
    setError({ message, id: errorSeq.current });
  }

  // Día de bar: empieza a las 6:00 AM (si son menos de las 6, el día
  // "de bar" sigue siendo el de ayer). Mismo criterio que usan cuentas/cobros.
  function inicioDiaBar() {
    const d = new Date();
    if (d.getHours() < 6) d.setDate(d.getDate() - 1);
    d.setHours(6, 0, 0, 0);
    return d;
  }

  async function cargarSesion() {
    const { data } = await supabase
      .from("sesiones")
      .select("*")
      .eq("activa", true)
      // Solo cuenta como turno activo si empezó dentro del día de bar actual.
      // Sin este filtro, un turno que se quedó "activa: true" porque nadie
      // pulsó "Cerrar turno" (se cerró la app/pestaña sin más) se retomaba
      // solo al abrir la app, incluso días después, sin preguntar nunca
      // "¿qué turno empieza?".
      .gte("created_at", inicioDiaBar().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSesion(data ?? null);
    setLoading(false);
  }

  // Limpieza puntual al montar: cierra cualquier turno de un día de bar
  // anterior que se haya quedado abierto sin querer, para que no siga
  // apareciendo en el histórico como "activo".
  async function cerrarSesionesAntiguas() {
    await supabase
      .from("sesiones")
      .update({ activa: false })
      .eq("activa", true)
      .lt("created_at", inicioDiaBar().toISOString());
  }

  useEffect(() => {
    cargarSesion();
    cerrarSesionesAntiguas();

    const channel = supabase
      .channel("sesion-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sesiones" }, cargarSesion)
      .subscribe();

    const poll = setInterval(cargarSesion, 10000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function iniciarTurno(turno: "mañana" | "tarde", cajaInicio: number = 0) {
    const id = `${turno}-${Date.now()}`;
    const fecha = new Date().toDateString();
    const { data, error } = await supabase
      .from("sesiones")
      .insert({ id, turno, fecha, activa: true, caja_inicio: cajaInicio })
      .select()
      .single();
    if (error) { reportError(`No se pudo iniciar el turno: ${error.message}`); return; }
    if (data) setSesion(data as Sesion);
  }

  async function cerrarTurno() {
    if (!sesion) return;
    const { error } = await supabase.from("sesiones").update({ activa: false }).eq("id", sesion.id);
    if (error) { reportError(`No se pudo cerrar el turno: ${error.message}`); return; }
    setSesion(null);
  }

  async function actualizarCaja(importe: number) {
    if (!sesion) return;
    setSesion((prev) => prev ? { ...prev, caja_inicio: importe } : prev);
    const { error } = await supabase.from("sesiones").update({ caja_inicio: importe }).eq("id", sesion.id);
    if (error) reportError(`No se pudo guardar la caja: ${error.message}`);
  }

  return { sesion, loading, error, iniciarTurno, cerrarTurno, actualizarCaja };
}
