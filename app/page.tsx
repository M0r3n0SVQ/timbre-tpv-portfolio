"use client";

import { useState, useEffect, useRef } from "react";
import { useCuentas } from "@/hooks/useCuentas";
import { useCobros } from "@/hooks/useCobros";
import { useSesion } from "@/hooks/useSesion";
import { useComandas } from "@/hooks/useComandas";
import { PRODUCTOS, CATEGORIAS } from "@/lib/carta";
import type { Cobro, Cuenta, Item } from "@/lib/types";

type Modal = "cobrar" | "parcial" | "dividir" | "cambio" | "historial" | "libre" | "ticket" | "cobro-rapido" | "lista-compra" | "juntar" | "cocina" | null;
type LineaParcial = { nombre: string; precio: number; max: number; cobrar: number };

export default function Page() {
  const { cuentas, loading, crearCuenta, actualizarCuenta, renombrarCuenta, eliminarCuenta, refetch: refetchCuentas } = useCuentas();
  const { cobros, cobrarCuenta, cerrarDia, refetch: refetchCobros } = useCobros();
  const { sesion, loading: loadingSesion, iniciarTurno, cerrarTurno } = useSesion();
  const { servidas, servirUno, servirTodo, limpiarCuenta } = useComandas();

  const [idActiva, setIdActiva] = useState<string | null>(null);

  const [categoria, setCategoria] = useState(CATEGORIAS[0]);

  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");

  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreEditado, setNombreEditado] = useState("");

  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);

  const [libreNombre, setLibreNombre] = useState("");
  const [libreImporte, setLibreImporte] = useState("");

  const [confirmandoCierreTurno, setConfirmandoCierreTurno] = useState(false);

  const [seleccionParcial, setSeleccionParcial] = useState<LineaParcial[]>([]);

  const [modal, setModal] = useState<Modal>(null);
  const [efectivo, setEfectivo] = useState("");
  const [personas, setPersonas] = useState(2);
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  const [cobrando, setCobrando] = useState(false);

  const [vistaMovil, setVistaMovil] = useState<"carta" | "ticket">("carta");

  // Cobro rápido
  const [itemsRapidos, setItemsRapidos] = useState<Item[]>([]);
  const [categoriaRapida, setCategoriaRapida] = useState(CATEGORIAS[0]);

  // Lista de compra
  const [listaCompra, setListaCompra] = useState<{ texto: string; hecho: boolean }[]>([]);
  const [nuevoItemCompra, setNuevoItemCompra] = useState("");
  const inputCompraRef = useRef<HTMLInputElement>(null);

  // Historial: cobro expandido para ver ticket
  const [cobroExpandido, setCobroExpandido] = useState<string | null>(null);

  // Juntar cuentas: ID de la cuenta que se absorbe
  const [idCuentaJuntar, setIdCuentaJuntar] = useState<string | null>(null);

  // Dropdown selector de cuentas
  const [mostrandoDropdown, setMostrandoDropdown] = useState(false);
  const dropdownListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mostrandoDropdown || !idActiva || !dropdownListRef.current) return;
    const el = dropdownListRef.current.querySelector(`[data-id="${idActiva}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [mostrandoDropdown, idActiva]);

  // Guardar/cargar lista de compra desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("timbre-lista-compra");
      if (saved) setListaCompra(JSON.parse(saved));
    } catch {}
  }, []);

  // Guardar lista de compra en localStorage al cambiar
  useEffect(() => {
    localStorage.setItem("timbre-lista-compra", JSON.stringify(listaCompra));
  }, [listaCompra]);

  // ── Computed ───────────────────────────────────────────────
  const cuentaActiva = cuentas.find((c) => c.id === idActiva) ?? null;
  const productosFiltrados = PRODUCTOS.filter((p) => p.categoria === categoria);
  const productosRapidosFiltrados = PRODUCTOS.filter((p) => p.categoria === categoriaRapida);
  const totalDia = cobros.reduce((s, c) => s + Number(c.total), 0);
  const cambio = parseFloat(efectivo || "0") - (cuentaActiva?.total ?? 0);
  const sinItems = (cuentaActiva?.items.length ?? 0) === 0;
  const totalRapido = itemsRapidos.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const itemsCompraPendientes = listaCompra.filter((i) => !i.hecho).length;
  const cuentasParaJuntar = cuentas.filter((c) => c.id !== idActiva);

  const CATS_COCINA = ["Montaditos", "Tapas"];
  const pedidosPendientes = cuentas.flatMap((cuenta) =>
    cuenta.items
      .filter((item) => {
        const p = PRODUCTOS.find((pr) => pr.nombre === item.nombre);
        return p && CATS_COCINA.includes(p.categoria);
      })
      .map((item) => {
        const servida = servidas.find((s) => s.cuenta_id === cuenta.id && s.item_nombre === item.nombre);
        const pendiente = item.cantidad - (servida?.cantidad_servida ?? 0);
        return { cuentaId: cuenta.id, cuentaNombre: cuenta.nombre, item, pendiente };
      })
      .filter((x) => x.pendiente > 0)
  );

  // ── Handlers ──────────────────────────────────────────────

  function handleRefrescar() {
    refetchCuentas();
    refetchCobros();
  }

  async function handleCrearCuenta() {
    if (!nuevoNombre.trim()) return;
    const nueva = await crearCuenta(nuevoNombre.trim());
    if (nueva) { setIdActiva(nueva.id); setVistaMovil("ticket"); }
    setNuevoNombre("");
    setCreando(false);
    setMostrandoDropdown(false);
  }

  async function handleGuardarNombre() {
    if (!cuentaActiva || !nombreEditado.trim()) { setEditandoNombre(false); return; }
    await renombrarCuenta(cuentaActiva.id, nombreEditado.trim());
    setEditandoNombre(false);
  }

  async function handleBorrarCuenta() {
    if (!cuentaActiva) return;
    await eliminarCuenta(cuentaActiva.id);
    await limpiarCuenta(cuentaActiva.id);
    const siguiente = cuentas.find((c) => c.id !== cuentaActiva.id);
    setIdActiva(siguiente?.id ?? null);
    setConfirmandoBorrar(false);
  }

  async function handleAgregar(nombre: string, precio: number) {
    if (!cuentaActiva) return;
    const existe = cuentaActiva.items.find((i) => i.nombre === nombre);
    const items = existe
      ? cuentaActiva.items.map((i) =>
          i.nombre === nombre ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      : [...cuentaActiva.items, { nombre, precio, cantidad: 1 }];
    await actualizarCuenta(cuentaActiva.id, items);
  }

  async function handleSumar(nombre: string) {
    if (!cuentaActiva) return;
    await actualizarCuenta(
      cuentaActiva.id,
      cuentaActiva.items.map((i) =>
        i.nombre === nombre ? { ...i, cantidad: i.cantidad + 1 } : i
      )
    );
  }

  async function handleRestar(nombre: string) {
    if (!cuentaActiva) return;
    await actualizarCuenta(
      cuentaActiva.id,
      cuentaActiva.items
        .map((i) => (i.nombre === nombre ? { ...i, cantidad: i.cantidad - 1 } : i))
        .filter((i) => i.cantidad > 0)
    );
  }

  async function handleEliminarLinea(nombre: string) {
    if (!cuentaActiva) return;
    await actualizarCuenta(
      cuentaActiva.id,
      cuentaActiva.items.filter((i) => i.nombre !== nombre)
    );
  }

  async function handleAgregarLibre() {
    if (!cuentaActiva || !libreImporte) return;
    const precio = parseFloat(libreImporte);
    if (precio <= 0) return;
    const nombre = libreNombre.trim() || `Varios ${precio.toFixed(2)}€`;
    await handleAgregar(nombre, precio);
    setModal(null);
    setLibreNombre("");
    setLibreImporte("");
  }

  async function handleCobrar() {
    if (!cuentaActiva || cobrando) return;
    setCobrando(true);
    await cobrarCuenta(cuentaActiva, sesion?.id ?? "sin-sesion");
    await eliminarCuenta(cuentaActiva.id);
    await limpiarCuenta(cuentaActiva.id);
    const siguiente = cuentas.find((c) => c.id !== cuentaActiva.id);
    setIdActiva(siguiente?.id ?? null);
    setModal(null);
    setEfectivo("");
    setCobrando(false);
  }

  function abrirCobroParcial() {
    if (!cuentaActiva) return;
    setSeleccionParcial(
      cuentaActiva.items.map((i) => ({
        nombre: i.nombre,
        precio: i.precio,
        max: i.cantidad,
        cobrar: i.cantidad,
      }))
    );
    setModal("parcial");
  }

  async function handleCobrarParcial() {
    if (!cuentaActiva || cobrando) return;
    const itemsACobrar = seleccionParcial
      .filter((l) => l.cobrar > 0)
      .map((l) => ({ nombre: l.nombre, precio: l.precio, cantidad: l.cobrar }));
    if (itemsACobrar.length === 0) return;
    setCobrando(true);
    await cobrarCuenta(cuentaActiva, sesion?.id ?? "sin-sesion", itemsACobrar);
    const restantes = cuentaActiva.items
      .map((i) => {
        const l = seleccionParcial.find((s) => s.nombre === i.nombre);
        return l ? { ...i, cantidad: i.cantidad - l.cobrar } : i;
      })
      .filter((i) => i.cantidad > 0);
    if (restantes.length === 0) {
      await eliminarCuenta(cuentaActiva.id);
      await limpiarCuenta(cuentaActiva.id);
      setIdActiva(cuentas.find((c) => c.id !== cuentaActiva.id)?.id ?? null);
    } else {
      await actualizarCuenta(cuentaActiva.id, restantes);
    }
    setModal(null);
    setCobrando(false);
  }

  async function handleCerrarDia() {
    await cerrarDia();
    await cerrarTurno();
    setConfirmandoCierre(false);
    setModal(null);
  }

  // ── Cobro rápido ──────────────────────────────────────────

  function agregarItemRapido(nombre: string, precio: number) {
    setItemsRapidos((prev) => {
      const existe = prev.find((i) => i.nombre === nombre);
      if (existe) return prev.map((i) => i.nombre === nombre ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { nombre, precio, cantidad: 1 }];
    });
  }

  function restarItemRapido(nombre: string) {
    setItemsRapidos((prev) =>
      prev.map((i) => i.nombre === nombre ? { ...i, cantidad: i.cantidad - 1 } : i)
          .filter((i) => i.cantidad > 0)
    );
  }

  async function handleCobrarRapido() {
    if (cobrando || itemsRapidos.length === 0) return;
    setCobrando(true);
    const hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const cuentaFake: Cuenta = {
      id: "rapido",
      nombre: `Rápido ${hora}`,
      items: itemsRapidos,
      total: totalRapido,
      created_at: new Date().toISOString(),
    };
    await cobrarCuenta(cuentaFake, sesion?.id ?? "sin-sesion");
    setItemsRapidos([]);
    setModal(null);
    setCobrando(false);
  }

  // ── Lista de compra ───────────────────────────────────────

  function agregarItemCompra() {
    if (!nuevoItemCompra.trim()) return;
    setListaCompra((prev) => [...prev, { texto: nuevoItemCompra.trim(), hecho: false }]);
    setNuevoItemCompra("");
    setTimeout(() => inputCompraRef.current?.focus(), 50);
  }

  function toggleItemCompra(idx: number) {
    setListaCompra((prev) => prev.map((i, j) => j === idx ? { ...i, hecho: !i.hecho } : i));
  }

  function eliminarItemCompra(idx: number) {
    setListaCompra((prev) => prev.filter((_, j) => j !== idx));
  }

  function borrarCompletados() {
    setListaCompra((prev) => prev.filter((i) => !i.hecho));
  }

  // ── Juntar cuentas ────────────────────────────────────────

  async function handleJuntarCuentas() {
    if (!cuentaActiva || !idCuentaJuntar || cobrando) return;
    const cuentaFuente = cuentas.find((c) => c.id === idCuentaJuntar);
    if (!cuentaFuente) return;
    setCobrando(true);
    const itemsMerged = [...cuentaActiva.items];
    for (const item of cuentaFuente.items) {
      const existente = itemsMerged.find((i) => i.nombre === item.nombre);
      if (existente) existente.cantidad += item.cantidad;
      else itemsMerged.push({ ...item });
    }
    await actualizarCuenta(cuentaActiva.id, itemsMerged);
    await eliminarCuenta(idCuentaJuntar);
    setIdCuentaJuntar(null);
    setModal(null);
    setCobrando(false);
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col bg-gray-50 text-gray-900 overflow-hidden select-none relative"
         style={{ height: "100dvh" }}>

      {/* ── Header ── */}
      <header
        className="shrink-0 bg-white border-b border-gray-200"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Fila 1: Marca · Turno (iconos) · Historial (icono) */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1.5">
          {/* Logo */}
          <div className="flex items-center shrink-0">
            <img src="/logo.jpg" alt="Cervecería El Timbre" className="h-9 w-auto rounded-xl object-contain bg-white p-0.5" />
          </div>

          <div className="flex-1" />

          {/* Indicador de turno activo (solo visual, no es botón) */}
          {sesion && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
              sesion.turno === "mañana" ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25"
            }`}>
              {sesion.turno === "mañana" ? (
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
              <span className="capitalize">{sesion.turno}</span>
            </div>
          )}

          {/* Cocina */}
          <button
            onClick={() => setModal("cocina")}
            title="Cocina"
            className="relative shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-400 touch-manipulation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            {pedidosPendientes.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center leading-none">
                {pedidosPendientes.length}
              </span>
            )}
          </button>

          {/* Historial: icono + badge, sin texto */}
          <button
            onClick={() => { setConfirmandoCierre(false); setCobroExpandido(null); setModal("historial"); }}
            title="Historial"
            className="relative shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-400 touch-manipulation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {cobros.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[9px] font-bold rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center leading-none">
                {cobros.length}
              </span>
            )}
          </button>
        </div>

        {/* Fila 2: Cuenta · Cobro rápido · Compra */}
        <div className="flex items-center gap-2 px-3 pb-2">
          {/* Selector de cuenta (dropdown) */}
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => { setMostrandoDropdown((v) => !v); setCreando(false); setNuevoNombre(""); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-100 active:bg-gray-200 rounded-xl touch-manipulation min-h-[44px] border border-gray-300/50"
            >
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="flex-1 text-left text-sm font-medium truncate">
                {loading ? "…" : (cuentaActiva?.nombre ?? "Seleccionar cuenta")}
              </span>
              {cuentaActiva && (
                <span className="text-amber-400 text-sm font-semibold tabular-nums shrink-0">{cuentaActiva.total.toFixed(2)}€</span>
              )}
              <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${mostrandoDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {mostrandoDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setMostrandoDropdown(false); setCreando(false); setNuevoNombre(""); }} />
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-gray-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ minWidth: "260px", maxHeight: "65dvh" }}>
                  <div className="overflow-y-auto flex-1" ref={dropdownListRef}>
                    {cuentas.length === 0 && !creando && (
                      <p className="text-gray-500 text-sm text-center py-4">Sin cuentas abiertas</p>
                    )}
                    {cuentas.map((c) => (
                      <button
                        key={c.id}
                        data-id={c.id}
                        onClick={() => { setIdActiva(c.id); setVistaMovil("ticket"); setEditandoNombre(false); setConfirmandoBorrar(false); setMostrandoDropdown(false); }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm touch-manipulation transition-colors ${
                          c.id === idActiva ? "bg-amber-500 text-black font-semibold" : "text-gray-700 active:bg-gray-100"
                        }`}
                      >
                        <span className="font-medium truncate">{c.nombre}</span>
                        <span className={`tabular-nums text-sm font-bold ml-3 shrink-0 ${c.id === idActiva ? "text-black" : "text-amber-600"}`}>{c.total.toFixed(2)}€</span>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 p-3 shrink-0">
                    {creando ? (
                      <div className="flex flex-col gap-2">
                        <input
                          value={nuevoNombre}
                          onChange={(e) => setNuevoNombre(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleCrearCuenta(); if (e.key === "Escape") { setCreando(false); setNuevoNombre(""); } }}
                          placeholder="Nombre de cuenta…"
                          className="w-full bg-gray-100 border border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2.5 outline-none text-sm text-gray-900"
                          style={{ fontSize: "16px" }}
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={handleCrearCuenta} className="flex-1 py-2 bg-amber-500 text-black rounded-xl text-sm font-bold touch-manipulation">Crear</button>
                          <button type="button" onClick={() => { setCreando(false); setNuevoNombre(""); }} className="flex-1 py-2 bg-gray-200 text-gray-500 rounded-xl text-sm touch-manipulation">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setCreando(true)} className="w-full py-2.5 text-sm text-gray-400 active:bg-gray-100 rounded-xl touch-manipulation text-center">
                        + Nueva cuenta
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Cobro rápido */}
          <button
            onClick={() => { setCategoriaRapida(CATEGORIAS[0]); setItemsRapidos([]); setModal("cobro-rapido"); }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-600 active:bg-amber-700 text-gray-900 text-xs font-bold touch-manipulation min-h-[44px]"
            title="Cobro rápido"
          >
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <span>Rápido</span>
          </button>

          {/* Lista de compra */}
          <button
            onClick={() => setModal("lista-compra")}
            className="shrink-0 relative flex items-center justify-center w-11 h-11 rounded-xl bg-gray-100 active:bg-gray-200 text-gray-400 touch-manipulation border border-gray-300/50"
            title="Lista de compra"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {itemsCompraPendientes > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {itemsCompraPendientes}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Mobile toggle ── */}
      <div className="md:hidden shrink-0 flex border-b border-gray-200 bg-white">
        {(["carta", "ticket"] as const).map((v) => (
          <button key={v} onClick={() => setVistaMovil(v)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors touch-manipulation ${vistaMovil === v ? "text-amber-400 border-b-2 border-amber-400" : "text-gray-500"}`}>
            {v === "ticket" && cuentaActiva ? `Ticket · ${cuentaActiva.total.toFixed(2)}€` : v === "carta" ? "Carta" : "Ticket"}
          </button>
        ))}
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT: Ticket ── */}
        <div className={`${vistaMovil === "ticket" ? "flex" : "hidden"} md:flex flex-col w-full md:w-72 lg:w-80 shrink-0 border-r border-gray-200`}>
          {!cuentaActiva ? (
            <div className="flex-1 flex items-center justify-center text-gray-700 text-sm p-6 text-center leading-relaxed">
              Selecciona una cuenta<br />o crea una nueva
            </div>
          ) : (
            <>
              {/* ── Cabecera de cuenta ── */}
              <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200">
                {editandoNombre ? (
                  <input
                    autoFocus
                    value={nombreEditado}
                    onChange={(e) => setNombreEditado(e.target.value)}
                    onBlur={handleGuardarNombre}
                    onKeyDown={(e) => { if (e.key === "Enter") handleGuardarNombre(); if (e.key === "Escape") setEditandoNombre(false); }}
                    className="flex-1 bg-gray-100 border border-amber-500 rounded-lg px-2 py-1 text-sm font-semibold outline-none"
                    style={{ fontSize: "16px" }}
                  />
                ) : (
                  <button
                    onClick={() => { setNombreEditado(cuentaActiva.nombre); setEditandoNombre(true); setConfirmandoBorrar(false); }}
                    className="flex-1 text-left text-sm font-semibold text-gray-900 touch-manipulation flex items-center gap-1.5"
                  >
                    {cuentaActiva.nombre}
                    <span className="text-gray-500 text-xs">✏</span>
                  </button>
                )}
                <button
                  onClick={() => { setConfirmandoBorrar(!confirmandoBorrar); setEditandoNombre(false); }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm touch-manipulation transition-colors ${confirmandoBorrar ? "bg-red-600 text-white" : "bg-gray-100 text-gray-400 active:text-red-400"}`}
                >
                  🗑
                </button>
              </div>

              {/* ── Confirmación borrar ── */}
              {confirmandoBorrar && (
                <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-red-950/60 border-b border-red-900">
                  <span className="text-red-300 text-xs">¿Borrar «{cuentaActiva.nombre}»?</span>
                  <div className="flex gap-1.5">
                    <button onClick={handleBorrarCuenta} className="px-3 py-1.5 bg-red-600 active:bg-red-700 rounded-lg text-xs font-bold touch-manipulation">Borrar</button>
                    <button onClick={() => setConfirmandoBorrar(false)} className="px-3 py-1.5 bg-gray-200 active:bg-gray-600 rounded-lg text-xs touch-manipulation">No</button>
                  </div>
                </div>
              )}

              {/* ── Lista de items ── */}
              <div className="flex-1 overflow-y-auto scroll-touch p-3 flex flex-col gap-2">
                {cuentaActiva.items.length === 0 ? (
                  <p className="text-gray-700 text-sm text-center py-10">Sin artículos todavía</p>
                ) : (
                  cuentaActiva.items.map((item) => (
                    <div key={item.nombre} className="flex items-center gap-1.5 bg-white rounded-xl px-2 py-2.5">
                      <span className="flex-1 text-sm font-medium leading-tight min-w-0 truncate">{item.nombre}</span>
                      <button onClick={() => handleRestar(item.nombre)} className="w-8 h-8 rounded-full bg-gray-200 active:bg-red-800 font-bold text-sm shrink-0 touch-manipulation">−</button>
                      <span className="w-5 text-center text-sm tabular-nums shrink-0 font-semibold">{item.cantidad}</span>
                      <button onClick={() => handleSumar(item.nombre)} className="w-8 h-8 rounded-full bg-gray-200 active:bg-green-800 font-bold text-sm shrink-0 touch-manipulation">+</button>
                      <span className="w-12 text-right text-xs text-amber-400 tabular-nums shrink-0 font-medium">{(item.precio * item.cantidad).toFixed(2)}€</span>
                      <button onClick={() => handleEliminarLinea(item.nombre)} className="w-7 h-7 rounded-lg bg-gray-100 active:bg-red-900 text-gray-400 active:text-red-400 text-sm shrink-0 touch-manipulation">×</button>
                    </div>
                  ))
                )}
              </div>

              {/* ── Total + acciones ── */}
              <div className="shrink-0 border-t border-gray-200 p-3 flex flex-col gap-2 bg-gray-50"
                   style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
                <div className="flex justify-between items-baseline px-1">
                  <span className="text-gray-400 text-sm uppercase tracking-wider">Total</span>
                  <span className="text-3xl font-bold text-amber-400 tabular-nums">{cuentaActiva.total.toFixed(2)}€</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModal("cobrar")} disabled={sinItems}
                    className="flex-1 py-4 bg-green-600 active:bg-green-700 disabled:opacity-25 disabled:cursor-not-allowed rounded-2xl font-bold text-white text-base touch-manipulation">
                    Cobrar todo
                  </button>
                  <button onClick={abrirCobroParcial} disabled={sinItems}
                    className="py-4 px-4 bg-green-900 active:bg-green-800 disabled:opacity-25 disabled:cursor-not-allowed rounded-2xl font-semibold text-sm text-green-300 touch-manipulation">
                    Parcial
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setPersonas(2); setModal("dividir"); }} disabled={sinItems}
                    className="flex-1 py-3 bg-blue-700 active:bg-blue-800 disabled:opacity-25 disabled:cursor-not-allowed rounded-xl text-sm font-semibold touch-manipulation">
                    Dividir
                  </button>
                  <button onClick={() => { setEfectivo(""); setModal("cambio"); }} disabled={sinItems}
                    className="flex-1 py-3 bg-gray-200 active:bg-gray-600 disabled:opacity-25 disabled:cursor-not-allowed rounded-xl text-sm font-semibold touch-manipulation">
                    Cambio
                  </button>
                  <button
                    onClick={() => { setIdCuentaJuntar(null); setModal("juntar"); }}
                    disabled={cuentasParaJuntar.length === 0}
                    className="flex-1 py-3 bg-purple-900 active:bg-purple-800 disabled:opacity-25 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-purple-300 touch-manipulation"
                  >
                    Juntar
                  </button>
                </div>
                <button onClick={() => setModal("ticket")} disabled={sinItems}
                  className="w-full py-2.5 bg-gray-100 active:bg-gray-200 disabled:opacity-25 border border-gray-300 rounded-xl text-sm text-gray-400 font-medium touch-manipulation">
                  🧾 Ver ticket
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: Catalog ── */}
        <div className={`${vistaMovil === "carta" ? "flex" : "hidden"} md:flex flex-col flex-1 overflow-hidden`}>

          {/* Category tabs */}
          <div className="shrink-0 flex gap-1.5 px-3 py-2 border-b border-gray-200 overflow-x-auto scroll-touch scrollbar-none">
            {CATEGORIAS.map((cat) => (
              <button key={cat} onClick={() => setCategoria(cat)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold touch-manipulation min-h-[40px] ${
                  categoria === cat ? "bg-amber-500 text-black" : "bg-gray-100 text-gray-400 active:bg-gray-200"
                }`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Importe libre */}
          <div className="shrink-0 px-3 pt-2.5">
            <button
              onClick={() => { setLibreNombre(""); setLibreImporte(""); setModal("libre"); }}
              disabled={!cuentaActiva}
              className="w-full py-2.5 bg-gray-100 active:bg-gray-200 disabled:opacity-30 border border-dashed border-gray-400 rounded-xl text-sm text-gray-400 font-medium touch-manipulation"
            >
              + Importe libre
            </button>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto scroll-touch p-3"
               style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
            {!cuentaActiva ? (
              <p className="text-gray-700 text-sm text-center py-16">Crea una cuenta para añadir productos</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                {productosFiltrados.map((p) => (
                  <button key={p.id} onClick={() => handleAgregar(p.nombre, p.precio)}
                    className="flex flex-col items-center justify-center p-3 bg-gray-100 active:bg-gray-200 active:scale-95 rounded-2xl transition-transform touch-manipulation"
                    style={{ minHeight: "72px" }}>
                    <span className="text-sm font-semibold text-center leading-tight">{p.nombre}</span>
                    <span className="text-amber-400 text-xs mt-1 tabular-nums font-medium">{p.precio.toFixed(2)}€</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MODALES
      ══════════════════════════════════════════════════ */}

      {/* ── Modal: Cobro rápido ── */}
      {modal === "cobro-rapido" && (
        <div className="fixed inset-0 bg-black/90 flex flex-col z-50"
             style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex-1 flex flex-col bg-white overflow-hidden">

            {/* Cabecera */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-bold">⚡ Cobro rápido</h2>
              <button onClick={() => setModal(null)} className="w-9 h-9 rounded-full bg-gray-100 active:bg-gray-200 text-gray-400 touch-manipulation">✕</button>
            </div>

            {/* Categorías */}
            <div className="shrink-0 flex gap-1.5 px-3 py-2 border-b border-gray-200 overflow-x-auto scroll-touch scrollbar-none">
              {CATEGORIAS.map((cat) => (
                <button key={cat} onClick={() => setCategoriaRapida(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold touch-manipulation ${
                    categoriaRapida === cat ? "bg-amber-500 text-black" : "bg-gray-100 text-gray-400 active:bg-gray-200"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Productos */}
            <div className="flex-1 overflow-y-auto scroll-touch p-3">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {productosRapidosFiltrados.map((p) => {
                  const cant = itemsRapidos.find((i) => i.nombre === p.nombre)?.cantidad ?? 0;
                  return (
                    <button key={p.id} onClick={() => agregarItemRapido(p.nombre, p.precio)}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-2xl active:scale-95 transition-transform touch-manipulation ${
                        cant > 0 ? "bg-amber-900/60 border border-amber-700" : "bg-gray-100 active:bg-gray-200"
                      }`}
                      style={{ minHeight: "72px" }}>
                      {cant > 0 && (
                        <span className="absolute top-1.5 right-1.5 bg-amber-500 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                          {cant}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-center leading-tight">{p.nombre}</span>
                      <span className="text-amber-400 text-xs mt-1 tabular-nums font-medium">{p.precio.toFixed(2)}€</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Items seleccionados + cobrar */}
            <div className="shrink-0 border-t border-gray-200 bg-gray-50">
              {itemsRapidos.length > 0 && (
                <div className="px-4 pt-3 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {itemsRapidos.map((item) => (
                    <div key={item.nombre} className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{item.nombre}</span>
                      <button onClick={() => restarItemRapido(item.nombre)} className="w-7 h-7 rounded-full bg-gray-200 active:bg-red-800 font-bold text-sm shrink-0 touch-manipulation">−</button>
                      <span className="w-5 text-center text-sm tabular-nums font-bold shrink-0">{item.cantidad}</span>
                      <button onClick={() => agregarItemRapido(item.nombre, item.precio)} className="w-7 h-7 rounded-full bg-gray-200 active:bg-green-800 font-bold text-sm shrink-0 touch-manipulation">+</button>
                      <span className="w-14 text-right text-xs text-amber-400 tabular-nums shrink-0 font-medium">{(item.precio * item.cantidad).toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-4 py-3 flex flex-col gap-2">
                {itemsRapidos.length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-1">Toca un producto para añadirlo</p>
                )}
                <div className="flex justify-between items-baseline px-1">
                  <span className="text-gray-400 text-sm uppercase tracking-wider">Total</span>
                  <span className="text-2xl font-bold text-amber-400 tabular-nums">{totalRapido.toFixed(2)}€</span>
                </div>
                <button
                  onClick={handleCobrarRapido}
                  disabled={cobrando || itemsRapidos.length === 0}
                  className="w-full py-4 bg-green-600 active:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-bold text-white text-base touch-manipulation"
                >
                  {cobrando ? "Guardando…" : `Cobrar ${totalRapido.toFixed(2)}€`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Lista de compra ── */}
      {modal === "lista-compra" && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md flex flex-col" style={{ maxHeight: "85dvh" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
              <h2 className="text-xl font-bold">🛒 Lista de compra</h2>
              <button onClick={() => setModal(null)} className="w-9 h-9 rounded-full bg-gray-100 active:bg-gray-200 text-gray-400 text-sm touch-manipulation">✕</button>
            </div>

            {/* Input añadir */}
            <div className="shrink-0 flex gap-2 px-4 pb-3">
              <input
                ref={inputCompraRef}
                value={nuevoItemCompra}
                onChange={(e) => setNuevoItemCompra(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") agregarItemCompra(); }}
                placeholder="Añadir artículo…"
                className="flex-1 bg-gray-100 border border-gray-300 focus:border-amber-500 rounded-xl px-4 py-3 outline-none text-sm"
                style={{ fontSize: "16px" }}
              />
              <button
                onClick={agregarItemCompra}
                disabled={!nuevoItemCompra.trim()}
                className="w-12 bg-amber-500 active:bg-amber-600 disabled:opacity-30 rounded-xl font-bold text-lg touch-manipulation"
              >+</button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto scroll-touch px-4 flex flex-col gap-1.5 pb-2">
              {listaCompra.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-10">La lista está vacía</p>
              ) : (
                listaCompra.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-3">
                    <button
                      onClick={() => toggleItemCompra(idx)}
                      className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center touch-manipulation transition-colors ${
                        item.hecho ? "bg-green-500 border-green-500 text-white" : "border-gray-400 active:border-green-500"
                      }`}
                    >
                      {item.hecho && <span className="text-xs font-bold">✓</span>}
                    </button>
                    <span className={`flex-1 text-sm ${item.hecho ? "line-through text-gray-500" : "text-gray-900"}`}>{item.texto}</span>
                    <button onClick={() => eliminarItemCompra(idx)} className="w-7 h-7 rounded-lg bg-gray-200 active:bg-red-900 text-gray-400 active:text-red-400 text-sm shrink-0 touch-manipulation">×</button>
                  </div>
                ))
              )}
            </div>

            {/* Acciones */}
            <div className="shrink-0 border-t border-gray-200 px-4 pt-3 pb-4 flex flex-col gap-2">
              {listaCompra.some((i) => i.hecho) && (
                <button onClick={borrarCompletados} className="w-full py-3 bg-gray-100 active:bg-gray-200 rounded-xl text-sm text-gray-400 touch-manipulation">
                  Borrar completados ({listaCompra.filter((i) => i.hecho).length})
                </button>
              )}
              <button onClick={() => setModal(null)} className="w-full py-3 bg-gray-100 active:bg-gray-200 rounded-xl text-gray-400 touch-manipulation">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Importe libre ── */}
      {modal === "libre" && cuentaActiva && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full sm:max-w-sm flex flex-col gap-3">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto sm:hidden mb-1" />
            <h2 className="text-xl font-bold text-center">Importe libre</h2>
            <input
              value={libreNombre}
              onChange={(e) => setLibreNombre(e.target.value)}
              placeholder="Descripción (opcional)"
              className="bg-gray-100 border border-gray-300 focus:border-amber-500 rounded-xl px-4 py-3 outline-none text-sm"
              style={{ fontSize: "16px" }}
            />
            <div className="bg-gray-100 rounded-2xl px-4 py-3 text-right text-3xl font-bold tabular-nums min-h-[56px]">
              {libreImporte || "0"}€
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map((d, i) => (
                <button key={i} onClick={() => {
                  if (d === "⌫") { setLibreImporte((e) => e.slice(0, -1)); return; }
                  if (d === "." && libreImporte.includes(".")) return;
                  if ((libreImporte.split(".")[1]?.length ?? 0) >= 2) return;
                  setLibreImporte((e) => e + d);
                }} className="py-4 bg-gray-100 active:bg-gray-600 rounded-xl font-semibold text-xl touch-manipulation">
                  {d}
                </button>
              ))}
            </div>
            <button onClick={handleAgregarLibre} disabled={!libreImporte || parseFloat(libreImporte) <= 0}
              className="w-full py-4 bg-amber-500 active:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-bold text-base touch-manipulation">
              Añadir al ticket
            </button>
            <button onClick={() => setModal(null)} className="w-full py-3 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-400 touch-manipulation">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Vista previa ticket ── */}
      {modal === "ticket" && cuentaActiva && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4"
             style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="w-full max-w-xs flex justify-end mb-3">
            <button onClick={() => setModal(null)}
              className="w-8 h-8 rounded-full bg-gray-100 active:bg-gray-200 text-gray-400 text-sm touch-manipulation">
              ✕
            </button>
          </div>
          <div className="w-full max-w-xs bg-white text-gray-900 rounded-2xl overflow-hidden shadow-2xl"
               style={{ fontFamily: "ui-monospace, monospace" }}>
            <div className="text-center py-5 px-4 border-b border-dashed border-gray-300">
              <img src="/logo.jpg" alt="Cervecería El Timbre" className="h-16 w-auto mx-auto object-contain" />
              <p className="text-xs text-gray-400 mt-1">
                {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                {" · "}
                {new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-sm font-semibold mt-2">{cuentaActiva.nombre}</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-1.5">
              {cuentaActiva.items.map((item) => (
                <div key={item.nombre} className="flex justify-between items-baseline text-sm">
                  <span className="flex-1 truncate">{item.nombre}</span>
                  <span className="text-gray-400 text-xs mx-2 shrink-0">{item.cantidad}×{item.precio.toFixed(2)}</span>
                  <span className="font-semibold tabular-nums shrink-0">{(item.precio * item.cantidad).toFixed(2)}€</span>
                </div>
              ))}
            </div>
            <div className="mx-4 border-t border-dashed border-gray-300" />
            <div className="flex justify-between items-center px-4 py-3">
              <span className="font-bold text-base tracking-wider uppercase">Total</span>
              <span className="font-bold text-2xl tabular-nums">{cuentaActiva.total.toFixed(2)}€</span>
            </div>
            <div className="text-center py-3 border-t border-dashed border-gray-300">
              <p className="text-xs text-gray-400">¡Gracias por tu visita!</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Cobro parcial ── */}
      {modal === "parcial" && cuentaActiva && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm flex flex-col" style={{ maxHeight: "85dvh" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="px-5 pt-4 pb-3 shrink-0">
              <h2 className="text-xl font-bold">Cobro parcial</h2>
              <p className="text-gray-400 text-sm mt-0.5">{cuentaActiva.nombre}</p>
            </div>
            <div className="flex-1 overflow-y-auto scroll-touch px-4 flex flex-col gap-2 pb-2">
              {seleccionParcial.map((linea, idx) => (
                <div key={linea.nombre} className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{linea.nombre}</p>
                    <p className="text-xs text-gray-400">{linea.precio.toFixed(2)}€/u · hay {linea.max}</p>
                  </div>
                  <button
                    onClick={() => setSeleccionParcial((prev) => prev.map((l, i) => i === idx ? { ...l, cobrar: Math.max(0, l.cobrar - 1) } : l))}
                    className="w-8 h-8 rounded-full bg-gray-200 active:bg-red-800 font-bold text-sm shrink-0 touch-manipulation"
                  >−</button>
                  <span className={`w-6 text-center text-sm tabular-nums font-bold shrink-0 ${linea.cobrar === 0 ? "text-gray-500" : "text-gray-900"}`}>
                    {linea.cobrar}
                  </span>
                  <button
                    onClick={() => setSeleccionParcial((prev) => prev.map((l, i) => i === idx ? { ...l, cobrar: Math.min(l.max, l.cobrar + 1) } : l))}
                    className="w-8 h-8 rounded-full bg-gray-200 active:bg-green-800 font-bold text-sm shrink-0 touch-manipulation"
                  >+</button>
                  <span className={`w-14 text-right text-sm tabular-nums shrink-0 font-medium ${linea.cobrar === 0 ? "text-gray-500" : "text-amber-400"}`}>
                    {(linea.precio * linea.cobrar).toFixed(2)}€
                  </span>
                </div>
              ))}
            </div>
            <div className="shrink-0 border-t border-gray-200 px-5 py-3 flex justify-between items-baseline">
              <span className="text-gray-400 text-sm uppercase tracking-wider">A cobrar</span>
              <span className="text-2xl font-bold text-amber-400 tabular-nums">
                {seleccionParcial.reduce((s, l) => s + l.precio * l.cobrar, 0).toFixed(2)}€
              </span>
            </div>
            <div className="shrink-0 px-4 pb-4 flex flex-col gap-2">
              <button
                onClick={handleCobrarParcial}
                disabled={cobrando || seleccionParcial.every((l) => l.cobrar === 0)}
                className="w-full py-4 bg-green-600 active:bg-green-700 disabled:opacity-30 rounded-2xl font-bold text-white text-base touch-manipulation"
              >
                {cobrando ? "Guardando…" : `Cobrar ${seleccionParcial.reduce((s, l) => s + l.precio * l.cobrar, 0).toFixed(2)}€`}
              </button>
              <button onClick={() => setModal(null)} className="w-full py-3 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-400 touch-manipulation">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Cobrar ── */}
      {modal === "cobrar" && cuentaActiva && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full sm:max-w-sm flex flex-col gap-4">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto sm:hidden mb-1" />
            <h2 className="text-xl font-bold text-center">Cobrar cuenta</h2>
            <p className="text-center text-gray-400 font-medium">{cuentaActiva.nombre}</p>
            <p className="text-center text-5xl font-bold text-amber-400 tabular-nums py-2">{cuentaActiva.total.toFixed(2)}€</p>
            <button onClick={handleCobrar} disabled={cobrando}
              className="w-full py-4 bg-green-600 active:bg-green-700 disabled:opacity-50 rounded-2xl font-bold text-white text-lg touch-manipulation">
              {cobrando ? "Guardando…" : "Confirmar cobro"}
            </button>
            <button onClick={() => setModal(null)} className="w-full py-4 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-400 touch-manipulation">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Dividir ── */}
      {modal === "dividir" && cuentaActiva && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full sm:max-w-sm flex flex-col gap-4">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto sm:hidden mb-1" />
            <h2 className="text-xl font-bold text-center">Dividir cuenta</h2>
            <p className="text-center text-gray-400">Total: <span className="text-gray-900 font-semibold">{cuentaActiva.total.toFixed(2)}€</span></p>
            <div className="flex items-center justify-center gap-6 py-2">
              <button onClick={() => setPersonas((p) => Math.max(2, p - 1))} className="w-14 h-14 rounded-full bg-gray-200 active:bg-gray-600 text-2xl font-bold touch-manipulation">−</button>
              <span className="text-4xl font-bold w-12 text-center tabular-nums">{personas}</span>
              <button onClick={() => setPersonas((p) => p + 1)} className="w-14 h-14 rounded-full bg-gray-200 active:bg-gray-600 text-2xl font-bold touch-manipulation">+</button>
            </div>
            <p className="text-center text-gray-400 text-sm">{personas} personas</p>
            <div className="bg-gray-100 rounded-2xl p-5 text-center">
              <p className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Cada uno paga</p>
              <p className="text-5xl font-bold text-amber-400 tabular-nums">{(cuentaActiva.total / personas).toFixed(2)}€</p>
            </div>
            <button onClick={() => setModal(null)} className="w-full py-4 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-400 touch-manipulation">Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Cambio ── */}
      {modal === "cambio" && cuentaActiva && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full sm:max-w-sm flex flex-col gap-3">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto sm:hidden mb-1" />
            <h2 className="text-xl font-bold text-center">Calcular cambio</h2>
            <p className="text-center text-gray-400">Total: <span className="text-gray-900 font-semibold">{cuentaActiva.total.toFixed(2)}€</span></p>
            <div className="bg-gray-100 rounded-2xl px-4 py-3 text-right text-3xl font-bold tabular-nums min-h-[56px]">{efectivo || "0"}€</div>
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map((d, i) => (
                <button key={i} onClick={() => {
                  if (d === "⌫") { setEfectivo((e) => e.slice(0, -1)); return; }
                  if (d === "." && efectivo.includes(".")) return;
                  if ((efectivo.split(".")[1]?.length ?? 0) >= 2) return;
                  setEfectivo((e) => e + d);
                }} className="py-4 bg-gray-100 active:bg-gray-600 rounded-xl font-semibold text-xl touch-manipulation">{d}</button>
              ))}
            </div>
            {parseFloat(efectivo || "0") > 0 && (
              <div className="bg-gray-100 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Cambio</p>
                <p className={`text-4xl font-bold tabular-nums ${cambio >= 0 ? "text-green-400" : "text-red-400"}`}>{cambio.toFixed(2)}€</p>
              </div>
            )}
            <button onClick={() => setModal(null)} className="w-full py-4 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-400 touch-manipulation">Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Juntar cuentas ── */}
      {modal === "juntar" && cuentaActiva && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm flex flex-col" style={{ maxHeight: "75dvh" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="px-5 pt-4 pb-2 shrink-0">
              <h2 className="text-xl font-bold">Juntar con…</h2>
              <p className="text-gray-400 text-sm mt-0.5">Los artículos se añadirán a <span className="text-gray-900 font-semibold">«{cuentaActiva.nombre}»</span></p>
            </div>
            <div className="flex-1 overflow-y-auto scroll-touch px-4 py-2 flex flex-col gap-2">
              {cuentasParaJuntar.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No hay otras cuentas abiertas</p>
              ) : (
                cuentasParaJuntar.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setIdCuentaJuntar(c.id === idCuentaJuntar ? null : c.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 touch-manipulation transition-colors ${
                      c.id === idCuentaJuntar
                        ? "bg-purple-900/60 border-purple-500 text-white"
                        : "bg-gray-100 border-gray-200 active:border-gray-400 text-gray-500"
                    }`}
                  >
                    <span className="font-semibold text-sm">{c.nombre}</span>
                    <span className="text-amber-400 tabular-nums text-sm">{c.total.toFixed(2)}€</span>
                  </button>
                ))
              )}
            </div>
            <div className="shrink-0 border-t border-gray-200 px-4 pt-3 pb-4 flex flex-col gap-2">
              <button
                onClick={handleJuntarCuentas}
                disabled={!idCuentaJuntar || cobrando}
                className="w-full py-4 bg-purple-700 active:bg-purple-600 disabled:opacity-30 rounded-2xl font-bold text-base touch-manipulation"
              >
                {cobrando ? "Juntando…" : idCuentaJuntar
                  ? `Juntar con «${cuentas.find((c) => c.id === idCuentaJuntar)?.nombre}»`
                  : "Selecciona una cuenta"}
              </button>
              <button onClick={() => { setModal(null); setIdCuentaJuntar(null); }} className="w-full py-3 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-400 touch-manipulation">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Historial ── */}
      {modal === "historial" && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md flex flex-col" style={{ maxHeight: "85dvh" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
              <h2 className="text-xl font-bold">Historial del día</h2>
              <button onClick={() => { setModal(null); setConfirmandoCierre(false); setConfirmandoCierreTurno(false); }} className="w-9 h-9 rounded-full bg-gray-100 active:bg-gray-200 text-gray-400 text-sm touch-manipulation">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto scroll-touch px-4 pb-2 flex flex-col gap-3">
              {cobros.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-10">No hay cuentas cobradas aún</p>
              ) : (() => {
                const sesiones = cobros.reduce<{ id: string; cobros: Cobro[] }[]>((acc, cobro) => {
                  const sid = cobro.sesion_id ?? "sin-sesion";
                  const existente = acc.find((s) => s.id === sid);
                  if (existente) existente.cobros.push(cobro);
                  else acc.push({ id: sid, cobros: [cobro] });
                  return acc;
                }, []);

                return sesiones.map((sesion, si) => {
                  const totalSesion = sesion.cobros.reduce((s, c) => s + Number(c.total), 0);
                  let etiqueta = `Sesión ${si + 1}`;
                  let timestamp: number | null = null;
                  let colorEtiqueta = "text-gray-400";
                  if (sesion.id !== "sin-sesion") {
                    if (sesion.id.startsWith("mañana-")) {
                      etiqueta = "Turno de Mañana";
                      timestamp = parseInt(sesion.id.replace("mañana-", ""));
                      colorEtiqueta = "text-orange-400";
                    } else if (sesion.id.startsWith("tarde-")) {
                      etiqueta = "Turno de Tarde";
                      timestamp = parseInt(sesion.id.replace("tarde-", ""));
                      colorEtiqueta = "text-indigo-400";
                    } else {
                      timestamp = parseInt(sesion.id);
                    }
                  }
                  const horaInicio = timestamp
                    ? new Date(timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
                    : null;
                  return (
                    <div key={sesion.id}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${colorEtiqueta}`}>
                          {etiqueta}{horaInicio ? ` · desde ${horaInicio}` : ""}
                        </span>
                        <div className="flex-1 h-px bg-gray-100" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {sesion.cobros.map((cobro) => {
                          const expandido = cobroExpandido === cobro.id;
                          return (
                            <div key={cobro.id} className="bg-gray-100 rounded-2xl overflow-hidden">
                              {/* Fila principal: toca para expandir */}
                              <button
                                onClick={() => setCobroExpandido(expandido ? null : cobro.id)}
                                className="w-full flex items-start justify-between gap-3 px-4 py-3 touch-manipulation active:bg-gray-200 text-left"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm">{cobro.nombre_cuenta}</p>
                                  <p className="text-gray-400 text-xs mt-0.5">
                                    {new Date(cobro.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                    {" · "}
                                    {cobro.items.length} artículo{cobro.items.length !== 1 ? "s" : ""}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-amber-400 font-bold tabular-nums">{Number(cobro.total).toFixed(2)}€</span>
                                  <span className={`text-gray-400 text-xs transition-transform ${expandido ? "rotate-180" : ""}`}>▾</span>
                                </div>
                              </button>

                              {/* Ticket expandido */}
                              {expandido && (
                                <div className="border-t border-gray-300 px-4 py-3"
                                     style={{ fontFamily: "ui-monospace, monospace" }}>
                                  <div className="flex flex-col gap-1">
                                    {cobro.items.map((item) => (
                                      <div key={item.nombre} className="flex justify-between items-baseline text-xs">
                                        <span className="flex-1 truncate text-gray-500">{item.nombre}</span>
                                        <span className="text-gray-400 mx-2 shrink-0">{item.cantidad}×{item.precio.toFixed(2)}</span>
                                        <span className="text-gray-900 tabular-nums shrink-0 font-medium">{(item.precio * item.cantidad).toFixed(2)}€</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-2 pt-2 border-t border-dashed border-gray-300 flex justify-between items-baseline">
                                    <span className="text-gray-400 text-xs uppercase tracking-wider">Total</span>
                                    <span className="text-amber-400 font-bold tabular-nums text-sm">{Number(cobro.total).toFixed(2)}€</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className="flex justify-between px-1 py-1 text-xs text-gray-400">
                          <span>{sesion.cobros.length} cobro{sesion.cobros.length !== 1 ? "s" : ""}</span>
                          <span className="font-semibold text-gray-400">{totalSesion.toFixed(2)}€</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="shrink-0 border-t border-gray-200 px-5 py-3 flex justify-between items-baseline">
              <span className="text-gray-400 text-sm">{cobros.length} cuenta{cobros.length !== 1 ? "s" : ""} cobrada{cobros.length !== 1 ? "s" : ""}</span>
              <span className="text-2xl font-bold text-amber-400 tabular-nums">{totalDia.toFixed(2)}€</span>
            </div>
            <div className="shrink-0 px-4 pt-1 pb-4 flex flex-col gap-2">
              {!confirmandoCierre && !confirmandoCierreTurno && (
                <>
                  <button
                    onClick={() => setConfirmandoCierreTurno(true)}
                    className="w-full py-3.5 bg-gray-100 active:bg-gray-200 text-gray-500 rounded-2xl text-sm font-semibold touch-manipulation flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Cerrar turno
                  </button>
                  <button onClick={() => setConfirmandoCierre(true)} className="w-full py-3.5 bg-red-900/40 active:bg-red-800/60 text-red-400 rounded-2xl text-sm font-semibold touch-manipulation">Cerrar día</button>
                </>
              )}
              {confirmandoCierreTurno && (
                <>
                  <p className="text-center text-sm text-gray-400 pb-1">Se cerrará el turno y se pedirá el siguiente al abrir la app.</p>
                  <button
                    onClick={async () => { await cerrarTurno(); setConfirmandoCierreTurno(false); setModal(null); }}
                    className="w-full py-4 bg-gray-200 active:bg-gray-300 text-gray-700 rounded-2xl text-sm font-bold touch-manipulation"
                  >
                    Sí, cerrar turno
                  </button>
                  <button onClick={() => setConfirmandoCierreTurno(false)} className="w-full py-3 bg-gray-100 active:bg-gray-200 text-gray-400 rounded-2xl text-sm touch-manipulation">Cancelar</button>
                </>
              )}
              {confirmandoCierre && (
                <>
                  <p className="text-center text-sm text-gray-400 pb-1">¿Seguro? Se borrará todo el historial de hoy.</p>
                  <button onClick={handleCerrarDia} className="w-full py-4 bg-red-600 active:bg-red-700 text-gray-900 rounded-2xl text-sm font-bold touch-manipulation">Sí, cerrar y borrar historial</button>
                  <button onClick={() => setConfirmandoCierre(false)} className="w-full py-4 bg-gray-100 active:bg-gray-200 text-gray-400 rounded-2xl text-sm touch-manipulation">Cancelar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Modal Cocina ── */}
      {modal === "cocina" && (
        <div className="absolute inset-0 z-50 bg-gray-50 flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
            <button onClick={() => setModal(null)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 touch-manipulation">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="font-bold text-gray-900 flex-1 text-base">Cocina</h2>
            {pedidosPendientes.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2.5 py-0.5">
                {pedidosPendientes.length} pendiente{pedidosPendientes.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {pedidosPendientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                <svg className="w-14 h-14 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-sm">Todo servido</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {Array.from(new Set(pedidosPendientes.map((p) => p.cuentaId))).map((cuentaId) => {
                  const items = pedidosPendientes.filter((p) => p.cuentaId === cuentaId);
                  return (
                    <div key={cuentaId} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                        <span className="font-bold text-sm text-amber-700">{items[0].cuentaNombre}</span>
                      </div>
                      <div className="flex flex-col divide-y divide-gray-100">
                        {items.map(({ item, pendiente }) => (
                          <div key={item.nombre} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{item.nombre}</p>
                            </div>
                            <span className="text-xl font-bold text-gray-700 tabular-nums w-8 text-center shrink-0">×{pendiente}</span>
                            <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => servirUno(cuentaId, item.nombre)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-700 touch-manipulation text-xl font-bold"
                              >−</button>
                              <button
                                type="button"
                                onClick={() => servirTodo(cuentaId, item.nombre, item.cantidad)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-500 active:bg-green-600 text-white touch-manipulation"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Overlay: Splash / Inicio de turno ── */}
      {(loadingSesion || !sesion) && (
        <div className="absolute inset-0 z-[100] bg-gray-50 flex flex-col items-center justify-center px-8 gap-8"
             style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex flex-col items-center gap-2">
            <img src="/logo.jpg" alt="Cervecería El Timbre" className="w-36 h-36 rounded-3xl object-contain bg-white p-2 shadow-xl" />
            <p className="text-gray-400 text-sm mt-1">
              {loadingSesion ? "Cargando…" : "¿Qué turno empieza ahora?"}
            </p>
          </div>

          {loadingSesion ? (
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => iniciarTurno("mañana")}
                className="w-full py-5 rounded-2xl bg-amber-500 active:bg-amber-600 text-black font-bold text-lg touch-manipulation flex items-center justify-center gap-3"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
                Turno de mañana
              </button>
              <button
                onClick={() => iniciarTurno("tarde")}
                className="w-full py-5 rounded-2xl bg-indigo-600 active:bg-indigo-700 text-white font-bold text-lg touch-manipulation flex items-center justify-center gap-3"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                Turno de tarde
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
