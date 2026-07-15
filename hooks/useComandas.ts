"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type ComandaServida = {
  cuenta_id: string;
  item_nombre: string;
  // Varios platos comparten nombre Y precio entre categorías (p.ej. "Lomo
  // orza salmorejo" vale 3.40€ tanto en Montaditos como en Tapas). Ni el
  // nombre ni el precio por separado bastan para distinguirlos — hace
  // falta también la categoría.
  precio: number;
  categoria: string;
  cantidad_servida: number;
};

export function useComandas() {
  const [servidas, setServidas] = useState<ComandaServida[]>([]);
  // Refleja siempre el último valor conocido, actualizado de forma síncrona.
  // El estado de React (`servidas`) no se refresca hasta el siguiente
  // render, así que si se pulsa "servir" dos veces muy rápido, la segunda
  // llamada podía leer el mismo cantidad_servida desfasado que la primera
  // y perder una unidad servida. Leyendo de este ref en vez del closure de
  // `servidas` se evita esa pérdida.
  const servidasRef = useRef<ComandaServida[]>([]);
  // Cola secuencial: encadena las llamadas a guardar() para que se ejecuten
  // en orden estricto en el servidor. Sin esto, dos guardados casi
  // simultáneos podían completarse en el orden de red equivocado y dejar en
  // Supabase el valor más antiguo en vez del más reciente.
  const colaRef = useRef<Promise<void>>(Promise.resolve());

  async function fetchServidas() {
    const { data } = await supabase.from("comandas_servidas").select("*");
    if (data) {
      setServidas(data);
      servidasRef.current = data;
    }
  }

  useEffect(() => {
    fetchServidas();

    const channel = supabase
      .channel("comandas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas_servidas" }, fetchServidas)
      .subscribe();

    const poll = setInterval(fetchServidas, 3000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, []);

  function guardar(cuentaId: string, itemNombre: string, precio: number, categoria: string, cantidad: number) {
    // Optimistic update, síncrono, a partir del ref (no del estado de React).
    const exists = servidasRef.current.some((s) => s.cuenta_id === cuentaId && s.item_nombre === itemNombre && s.precio === precio && s.categoria === categoria);
    const next = exists
      ? servidasRef.current.map((s) => s.cuenta_id === cuentaId && s.item_nombre === itemNombre && s.precio === precio && s.categoria === categoria ? { ...s, cantidad_servida: cantidad } : s)
      : [...servidasRef.current, { cuenta_id: cuentaId, item_nombre: itemNombre, precio, categoria, cantidad_servida: cantidad }];
    servidasRef.current = next;
    setServidas(next);

    colaRef.current = colaRef.current.then(async () => {
      // DELETE + INSERT: infalible sin importar si la fila existe o no
      await supabase.from("comandas_servidas")
        .delete()
        .eq("cuenta_id", cuentaId)
        .eq("item_nombre", itemNombre)
        .eq("precio", precio)
        .eq("categoria", categoria);

      await supabase.from("comandas_servidas")
        .insert({ cuenta_id: cuentaId, item_nombre: itemNombre, precio, categoria, cantidad_servida: cantidad });

      // Confirmar estado real desde Supabase
      await fetchServidas();
    });
    return colaRef.current;
  }

  async function servirUno(cuentaId: string, itemNombre: string, precio: number, categoria: string) {
    const actual = servidasRef.current.find((s) => s.cuenta_id === cuentaId && s.item_nombre === itemNombre && s.precio === precio && s.categoria === categoria)?.cantidad_servida ?? 0;
    await guardar(cuentaId, itemNombre, precio, categoria, actual + 1);
  }

  async function servirTodo(cuentaId: string, itemNombre: string, precio: number, categoria: string, cantidad: number) {
    await guardar(cuentaId, itemNombre, precio, categoria, cantidad);
  }

  async function limpiarCuenta(cuentaId: string) {
    const next = servidasRef.current.filter((s) => s.cuenta_id !== cuentaId);
    servidasRef.current = next;
    setServidas(next);
    await supabase.from("comandas_servidas").delete().eq("cuenta_id", cuentaId);
  }

  // Limpia el registro de servido de un solo item (cuando se quita del ticket
  // sin borrar la cuenta entera). Evita que si se repide el mismo plato más
  // tarde, un cantidad_servida "huérfano" haga que el pendiente salga <= 0
  // y el pedido no aparezca en cocina.
  async function limpiarItem(cuentaId: string, itemNombre: string, precio: number, categoria: string) {
    const next = servidasRef.current.filter((s) => !(s.cuenta_id === cuentaId && s.item_nombre === itemNombre && s.precio === precio && s.categoria === categoria));
    servidasRef.current = next;
    setServidas(next);
    await supabase.from("comandas_servidas").delete().eq("cuenta_id", cuentaId).eq("item_nombre", itemNombre).eq("precio", precio).eq("categoria", categoria);
  }

  return { servidas, servirUno, servirTodo, limpiarCuenta, limpiarItem };
}
