"use client";

import { useState, useEffect, useRef } from "react";
import { useCuentas } from "@/hooks/useCuentas";
import { useCobros } from "@/hooks/useCobros";
import { useSesion } from "@/hooks/useSesion";
import { useComandas } from "@/hooks/useComandas";
import { useAuth } from "@/hooks/useAuth";
import NumPad from "@/components/NumPad";
import PantallaLogin from "@/components/PantallaLogin";
import BottomSheet from "@/components/BottomSheet";
import { PRODUCTOS, CATEGORIAS } from "@/lib/carta";
import { supabase } from "@/lib/supabase";
import { claveItem } from "@/lib/itemIdentity";
import { CATS_COCINA, categoriaCocina, esItemCocina, tieneCocinaPendiente, pendienteDe } from "@/lib/cocina";
import { calcularCambio, cubrePendiente, desglosePorMetodo, esImporteParcialValido, importePorPersona, itemsRestantes, parsearImporte, pendientePorCobrar, superaPendiente, totalLineas, totalSeleccion, type LineaParcial } from "@/lib/cobro";
import type { Cobro, Cuenta, Item, MetodoPago } from "@/lib/types";

type Modal = "cobrar" | "parcial" | "dividir" | "cambio" | "historial" | "libre" | "ticket" | "cobro-rapido" | "lista-compra" | "juntar" | "cocina" | null;

// Sin sesión no monto el TPV (sus hooks harían consultas que RLS rechaza)
export default function Page() {
  const { autenticado, iniciarSesion } = useAuth();

  if (autenticado === undefined) {
    return (
      <div className="bg-gray-50 flex items-center justify-center" style={{ height: "100dvh" }}>
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!autenticado) return <PantallaLogin iniciarSesion={iniciarSesion} />;
  return <TPV />;
}

function TPV() {
  const { cuentas, loading, error: errorCuentas, crearCuenta, actualizarCuenta, renombrarCuenta, eliminarCuenta, marcarPagada, abonarCuenta } = useCuentas();
  const { cobros, error: errorCobros, cobrarCuenta, actualizarMetodoPago, cerrarDia, restaurarCobros } = useCobros();
  const { sesion, loading: loadingSesion, error: errorSesion, iniciarTurno, cerrarTurno, actualizarCaja } = useSesion();
  const { servidas, servirUno, servirTodo, limpiarCuenta, limpiarItem } = useComandas();

  const [idActiva, setIdActiva] = useState<string | null>(null);

  const [categoria, setCategoria] = useState(CATEGORIAS[0]);

  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");

  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreEditado, setNombreEditado] = useState("");

  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);

  const [libreNombre, setLibreNombre] = useState("");
  const [libreImporte, setLibreImporte] = useState("");
  const [libreCategoria, setLibreCategoria] = useState("");

  const [confirmandoCierreTurno, setConfirmandoCierreTurno] = useState(false);

  // Inicio de turno: selección en 2 pasos (turno → caja)
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<"mañana" | "tarde" | null>(null);
  const [cajaInicioPendiente, setCajaInicioPendiente] = useState("");

  // Edición de caja en cualquier momento
  const [editandoCaja, setEditandoCaja] = useState(false);
  const [cajaEditada, setCajaEditada] = useState("");

  const [seleccionParcial, setSeleccionParcial] = useState<LineaParcial[]>([]);
  const [modoParcial, setModoParcial] = useState<"articulos" | "importe">("articulos");
  const [importeParcial, setImporteParcial] = useState("");

  const [modal, setModal] = useState<Modal>(null);
  const [efectivo, setEfectivo] = useState("");
  const [personas, setPersonas] = useState(2);
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  const [cerrandoDia, setCerrandoDia] = useState(false);
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");

  // Aviso de errores de red/Supabase en acciones del usuario (cobrar, guardar…).
  // Sin esto, si Supabase falla en silencio el camarero no se entera de que
  // algo no se ha guardado de verdad.
  const [toastError, setToastError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const ultimo = [errorCuentas, errorCobros, errorSesion]
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => b.id - a.id)[0];
    if (!ultimo) return;
    setToastError(ultimo.message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastError(null), 7000);
  }, [errorCuentas, errorCobros, errorSesion]);

  const [vistaMovil, setVistaMovil] = useState<"carta" | "ticket">("carta");

  // Cobro rápido
  const [itemsRapidos, setItemsRapidos] = useState<Item[]>([]);
  const [categoriaRapida, setCategoriaRapida] = useState(CATEGORIAS[0]);
  const [nombreRapido, setNombreRapido] = useState("");

  // Lista de compra
  const [listaCompra, setListaCompra] = useState<{ texto: string; hecho: boolean }[]>([]);
  const [nuevoItemCompra, setNuevoItemCompra] = useState("");
  const inputCompraRef = useRef<HTMLInputElement>(null);

  // Historial: cobro seleccionado para ver su ticket
  const [cobroParaTicket, setCobroParaTicket] = useState<Cobro | null>(null);

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

  // Cargar lista de compra: localStorage inmediato + Supabase como fuente de verdad
  const listaCompraLista = useRef(false);
  const ultimoCambioLocalCompra = useRef(0);
  const usuarioEditoCompra = useRef(false);
  useEffect(() => {
    async function cargarLista() {
      try {
        const saved = localStorage.getItem("timbre-lista-compra");
        if (saved) setListaCompra(JSON.parse(saved));
      } catch {}
      // Marcar listo ANTES de la llamada a Supabase para que cualquier edición del
      // usuario que llegue mientras carga quede guardada en vez de perderse.
      listaCompraLista.current = true;
      try {
        const { data } = await supabase.from("lista_compra").select("items").eq("id", "unica").maybeSingle();
        // Solo aplicar datos de Supabase si el usuario NO ha tocado la lista
        // todavía (evita sobreescribir lo que acaba de escribir).
        if (data?.items && !usuarioEditoCompra.current) setListaCompra(data.items);
      } catch {}
    }
    cargarLista();

    async function refrescarLista() {
      // Evita pisar una edición local que aún no se ha guardado (debounce 2s)
      if (Date.now() - ultimoCambioLocalCompra.current < 3000) return;
      const { data } = await supabase.from("lista_compra").select("items").eq("id", "unica").maybeSingle();
      if (data?.items) setListaCompra(data.items);
    }

    const channel = supabase
      .channel("lista-compra-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lista_compra" }, refrescarLista)
      .subscribe();

    const poll = setInterval(refrescarLista, 5000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, []);

  // Guardar lista de compra: localStorage inmediato + Supabase inmediato
  // Sin debounce: los cambios solo se disparan en acciones del usuario (añadir/borrar),
  // nunca en cada tecla, así que guardar al momento elimina la ventana en que el
  // polling podía restaurar un item recién borrado.
  useEffect(() => {
    if (!listaCompraLista.current) return;
    ultimoCambioLocalCompra.current = Date.now();
    try { localStorage.setItem("timbre-lista-compra", JSON.stringify(listaCompra)); } catch {}
    // Solo guardar en Supabase si fue el usuario quien cambió la lista (no una carga del sistema).
    // Evita que localStorage vacío o la carga inicial sobreescriba la lista real en Supabase.
    if (!usuarioEditoCompra.current) return;
    supabase.from("lista_compra").upsert({ id: "unica", items: listaCompra, updated_at: new Date().toISOString() }).then(() => {});
  }, [listaCompra]);

  // Backup automático en localStorage + Supabase
  const [backupTimestamp, setBackupTimestamp] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("timbre-backup-v1");
      return raw ? (JSON.parse(raw).timestamp ?? null) : null;
    } catch { return null; }
  });
  const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoContenidoBackup = useRef("");
  useEffect(() => {
    if (loading) return;
    // El polling trae arrays nuevos aunque no cambie nada y eso reiniciaba el
    // debounce, así que la copia nunca llegaba a Supabase. Comparo el contenido.
    const contenido = JSON.stringify({ cuentas, cobros });
    if (contenido === ultimoContenidoBackup.current) return;
    ultimoContenidoBackup.current = contenido;
    const ts = new Date().toISOString();
    const datos = { cuentas, cobros, timestamp: ts };
    // localStorage: inmediato
    try {
      localStorage.setItem("timbre-backup-v1", JSON.stringify(datos));
      setBackupTimestamp(ts);
    } catch {}
    // Supabase: debounce 8s para no saturar
    if (backupTimer.current) clearTimeout(backupTimer.current);
    backupTimer.current = setTimeout(() => {
      supabase.from("backups").upsert({ id: "ultimo", datos, updated_at: new Date().toISOString() }).then(({ error }) => {
        if (error) console.error("No se pudo guardar la copia del día en Supabase:", error.message);
      });
    }, 8000);
  }, [cuentas, cobros, loading]);

  // Auto-eliminar cuentas pagadas cuando ya no tienen pendientes en cocina
  useEffect(() => {
    const pagadas = cuentas.filter((c) => c.pagada);
    for (const cuenta of pagadas) {
      if (!tieneCocinaPendiente(cuenta.items, servidas, cuenta.id)) {
        eliminarCuenta(cuenta.id);
        limpiarCuenta(cuenta.id);
      }
    }
  }, [cuentas, servidas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si la cuenta activa se cobra desde otro dispositivo mientras está
  // abierta aquí, deseleccionarla automáticamente (vuelve al estado "sin
  // cuenta elegida"). Nunca salta a otra cuenta real, para no arriesgarse a
  // cobrar la cuenta equivocada sin darse cuenta del cambio.
  useEffect(() => {
    if (idActiva && cuentas.find((c) => c.id === idActiva)?.pagada) {
      setIdActiva(null);
    }
  }, [idActiva, cuentas]);

  // ── Computed ───────────────────────────────────────────────
  const cuentaActiva = cuentas.find((c) => c.id === idActiva) ?? null;
  // Lo que queda por cobrar de la cuenta activa, descontando lo ya pagado
  // "a cuenta" por un importe suelto (cobro parcial por importe).
  const pendienteCuenta = cuentaActiva ? pendientePorCobrar(cuentaActiva.total, cuentaActiva.cobrado_parcial) : 0;
  const productosFiltrados = PRODUCTOS.filter((p) => p.categoria === categoria).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const productosRapidosFiltrados = PRODUCTOS.filter((p) => p.categoria === categoriaRapida).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const { total: totalDia, efectivo: totalEfectivoDia, tarjeta: totalTarjetaDia } = desglosePorMetodo(cobros);
  const cambio = calcularCambio(efectivo, cuentaActiva?.total ?? 0);
  const sinItems = (cuentaActiva?.items.length ?? 0) === 0;
  const totalRapido = totalLineas(itemsRapidos);
  const itemsCompraPendientes = listaCompra.filter((i) => !i.hecho).length;
  const cuentasParaJuntar = cuentas.filter((c) => c.id !== idActiva && !c.pagada).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
  const cuentasAbiertas = cuentas.filter((c) => !c.pagada).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
  const ticketData = cobroParaTicket
    ? { nombre: cobroParaTicket.nombre_cuenta, items: cobroParaTicket.items, total: Number(cobroParaTicket.total), fecha: new Date(cobroParaTicket.created_at), metodoPago: cobroParaTicket.metodo_pago }
    : cuentaActiva
    ? { nombre: cuentaActiva.nombre, items: cuentaActiva.items, total: cuentaActiva.total, fecha: new Date() }
    : null;

  const pedidosPendientes = cuentas.flatMap((cuenta) =>
    cuenta.items
      .filter(esItemCocina)
      .map((item) => ({
        cuentaId: cuenta.id,
        cuentaNombre: cuenta.nombre,
        item,
        pendiente: pendienteDe(item, servidas, cuenta.id),
        categoria: categoriaCocina(item),
        pagada: !!cuenta.pagada,
      }))
      .filter((x) => x.pendiente > 0)
  ).sort((a, b) => {
    const ta = a.item.added_at ? new Date(a.item.added_at).getTime() : Infinity;
    const tb = b.item.added_at ? new Date(b.item.added_at).getTime() : Infinity;
    return ta - tb;
  });

  // ── Handlers ──────────────────────────────────────────────

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
    const siguiente = cuentas.find((c) => c.id !== cuentaActiva.id && !c.pagada);
    setIdActiva(siguiente?.id ?? null);
    setConfirmandoBorrar(false);
  }

  async function handleAgregar(nombre: string, precio: number, categoria?: string) {
    if (!cuentaActiva) return;
    const now = new Date().toISOString();
    // nombre+precio no basta para identificar la línea: hace falta también
    // la categoría (varios platos comparten nombre Y precio entre Montaditos
    // y Tapas, p.ej. "Lomo orza salmorejo" a 3.40€ en las dos).
    const existe = cuentaActiva.items.find((i) => claveItem(i.nombre, i.precio, i.categoria) === claveItem(nombre, precio, categoria));
    const extra = categoria ? { categoria } : {};
    const items = existe
      ? cuentaActiva.items.map((i) => {
          if (claveItem(i.nombre, i.precio, i.categoria) !== claveItem(nombre, precio, categoria)) return i;
          // Si todas las unidades ya fueron servidas (pendiente = 0), esta nueva
          // unidad es un pedido nuevo: resetear added_at para que vaya al final
          // de la cola de cocina, no al principio por tener un timestamp antiguo.
          const servida = servidas.find((s) => s.cuenta_id === cuentaActiva.id && claveItem(s.item_nombre, s.precio, s.categoria) === claveItem(nombre, precio, categoria));
          const todoServido = (servida?.cantidad_servida ?? 0) >= i.cantidad;
          return { ...i, ...extra, cantidad: i.cantidad + 1, ...(todoServido ? { added_at: now } : {}) };
        })
      : [...cuentaActiva.items, { nombre, precio, cantidad: 1, added_at: now, ...extra }];
    await actualizarCuenta(cuentaActiva.id, items);
  }

  async function handleSumar(nombre: string, precio: number, categoria?: string) {
    if (!cuentaActiva) return;
    const now = new Date().toISOString();
    await actualizarCuenta(
      cuentaActiva.id,
      cuentaActiva.items.map((i) => {
        if (claveItem(i.nombre, i.precio, i.categoria) !== claveItem(nombre, precio, categoria)) return i;
        // Igual que en handleAgregar (carta): si el plato ya salió entero de
        // cocina, esta unidad nueva es un pedido nuevo y va al final de la
        // cola, no al principio por conservar el added_at antiguo.
        const servida = servidas.find((s) => s.cuenta_id === cuentaActiva.id && claveItem(s.item_nombre, s.precio, s.categoria) === claveItem(nombre, precio, categoria));
        const todoServido = (servida?.cantidad_servida ?? 0) >= i.cantidad;
        return { ...i, cantidad: i.cantidad + 1, ...(todoServido ? { added_at: now } : {}) };
      })
    );
  }

  async function handleRestar(nombre: string, precio: number, categoria?: string) {
    if (!cuentaActiva) return;
    const items = cuentaActiva.items
      .map((i) => (claveItem(i.nombre, i.precio, i.categoria) === claveItem(nombre, precio, categoria) ? { ...i, cantidad: i.cantidad - 1 } : i))
      .filter((i) => i.cantidad > 0);
    await actualizarCuenta(cuentaActiva.id, items);
    // Si el item desaparece del ticket, limpiar su registro de "servido" para
    // que un pedido futuro no herede un cantidad_servida que lo deje oculto
    // de cocina. Se compara por nombre+precio+categoria: puede haber otra
    // línea con el mismo nombre en otra categoría (p.ej. "Queso" en
    // Montaditos y en Tapas) que no debe verse afectada.
    if (!items.some((i) => claveItem(i.nombre, i.precio, i.categoria) === claveItem(nombre, precio, categoria))) await limpiarItem(cuentaActiva.id, nombre, precio, categoria ?? "");
  }

  async function handleEliminarLinea(nombre: string, precio: number, categoria?: string) {
    if (!cuentaActiva) return;
    const items = cuentaActiva.items.filter((i) => claveItem(i.nombre, i.precio, i.categoria) !== claveItem(nombre, precio, categoria));
    await actualizarCuenta(cuentaActiva.id, items);
    if (!items.some((i) => claveItem(i.nombre, i.precio, i.categoria) === claveItem(nombre, precio, categoria))) await limpiarItem(cuentaActiva.id, nombre, precio, categoria ?? "");
  }

  async function handleAgregarLibre() {
    if (!cuentaActiva || !libreImporte) return;
    const precio = parseFloat(libreImporte);
    if (precio <= 0) return;
    const nombre = libreNombre.trim() || `Varios ${precio.toFixed(2)}€`;
    const existe = cuentaActiva.items.find((i) => claveItem(i.nombre, i.precio, i.categoria) === claveItem(nombre, precio, libreCategoria || undefined));
    const now = new Date().toISOString();
    const nuevoItem: Item = { nombre, precio, cantidad: 1, added_at: now, ...(libreCategoria ? { categoria: libreCategoria } : {}) };
    const extraLibre = libreCategoria ? { categoria: libreCategoria } : {};
    const items = existe
      ? cuentaActiva.items.map((i) => {
          if (claveItem(i.nombre, i.precio, i.categoria) !== claveItem(nombre, precio, libreCategoria || undefined)) return i;
          const servida = servidas.find((s) => s.cuenta_id === cuentaActiva.id && claveItem(s.item_nombre, s.precio, s.categoria) === claveItem(nombre, i.precio, i.categoria));
          const todoServido = (servida?.cantidad_servida ?? 0) >= i.cantidad;
          return { ...i, ...extraLibre, cantidad: i.cantidad + 1, ...(todoServido ? { added_at: now } : {}) };
        })
      : [...cuentaActiva.items, nuevoItem];
    await actualizarCuenta(cuentaActiva.id, items);
    setModal(null);
    setLibreNombre("");
    setLibreImporte("");
    setLibreCategoria("");
  }

  async function handleCobrar() {
    // cuentaActiva.pagada: alguien ya la cobró (p.ej. desde otro dispositivo)
    // mientras estaba abierta aquí. No volver a cobrarla.
    if (!cuentaActiva || cobrando || cuentaActiva.pagada) return;
    setCobrando(true);
    // Si ya se cobró parte por importe suelto, "Cobrar todo" solo cobra lo
    // que queda — el desglose de artículos del recibo sigue siendo el real,
    // pero el total cobrado ahora es el pendiente, no el total de la cuenta.
    if (pendienteCuenta > 0) {
      await cobrarCuenta(cuentaActiva, sesion?.id ?? "sin-sesion", undefined, pendienteCuenta, metodoPago);
    }
    const tieneCocina = tieneCocinaPendiente(cuentaActiva.items, servidas, cuentaActiva.id);
    if (tieneCocina) {
      await marcarPagada(cuentaActiva.id);
    } else {
      await eliminarCuenta(cuentaActiva.id);
      await limpiarCuenta(cuentaActiva.id);
    }
    const siguiente = cuentas.find((c) => c.id !== cuentaActiva.id && !c.pagada);
    setIdActiva(siguiente?.id ?? null);
    setModal(null);
    setEfectivo("");
    setMetodoPago("efectivo");
    setCobrando(false);
  }

  function abrirCobroParcial() {
    if (!cuentaActiva) return;
    setSeleccionParcial(
      cuentaActiva.items.map((i) => ({
        nombre: i.nombre,
        precio: i.precio,
        categoria: i.categoria,
        max: i.cantidad,
        cobrar: 0,
      }))
    );
    setModoParcial("articulos");
    setImporteParcial("");
    setMetodoPago("efectivo");
    setModal("parcial");
  }

  // Cobro parcial "por importe": para cuando el cliente paga una cantidad
  // suelta ("aquí tienes 50€, el resto luego") que no corresponde a ninguna
  // combinación exacta de artículos. No toca los artículos del ticket —
  // cocina los sigue viendo igual — solo lleva la cuenta de cuánto se ha
  // pagado ya (cobrado_parcial). Si el importe cubre todo lo pendiente,
  // cierra la cuenta igual que "Cobrar todo".
  async function handleCobrarPorImporte() {
    if (!cuentaActiva || cobrando || cuentaActiva.pagada) return;
    const importe = parsearImporte(importeParcial);
    if (!esImporteParcialValido(importe, pendienteCuenta)) return;
    setCobrando(true);
    await cobrarCuenta(cuentaActiva, sesion?.id ?? "sin-sesion", [{ nombre: "Pago a cuenta", precio: importe, cantidad: 1 }], undefined, metodoPago);
    await abonarCuenta(cuentaActiva.id, importe);
    if (cubrePendiente(pendienteCuenta, importe)) {
      const tieneCocina = tieneCocinaPendiente(cuentaActiva.items, servidas, cuentaActiva.id);
      if (tieneCocina) {
        await marcarPagada(cuentaActiva.id);
      } else {
        await eliminarCuenta(cuentaActiva.id);
        await limpiarCuenta(cuentaActiva.id);
      }
      setIdActiva(cuentas.find((c) => c.id !== cuentaActiva.id && !c.pagada)?.id ?? null);
    }
    setModal(null);
    setImporteParcial("");
    setMetodoPago("efectivo");
    setCobrando(false);
  }

  async function handleCobrarParcial() {
    if (!cuentaActiva || cobrando || cuentaActiva.pagada) return;
    const itemsACobrar = seleccionParcial
      .filter((l) => l.cobrar > 0)
      .map((l) => ({ nombre: l.nombre, precio: l.precio, categoria: l.categoria, cantidad: l.cobrar }));
    if (itemsACobrar.length === 0) return;
    setCobrando(true);
    await cobrarCuenta(cuentaActiva, sesion?.id ?? "sin-sesion", itemsACobrar, undefined, metodoPago);
    const restantes = itemsRestantes(cuentaActiva.items, seleccionParcial);
    if (restantes.length === 0) {
      const tieneCocina = tieneCocinaPendiente(cuentaActiva.items, servidas, cuentaActiva.id);
      if (tieneCocina) {
        await marcarPagada(cuentaActiva.id);
      } else {
        await eliminarCuenta(cuentaActiva.id);
        await limpiarCuenta(cuentaActiva.id);
      }
      setIdActiva(cuentas.find((c) => c.id !== cuentaActiva.id && !c.pagada)?.id ?? null);
    } else {
      await actualizarCuenta(cuentaActiva.id, restantes);
      // Igual que en handleRestar/handleEliminarLinea: si el cobro parcial deja
      // algún item en 0 unidades, limpiar su registro de servido.
      for (const item of cuentaActiva.items) {
        const sigueExistiendo = restantes.some((r) => claveItem(r.nombre, r.precio, r.categoria) === claveItem(item.nombre, item.precio, item.categoria));
        if (!sigueExistiendo) await limpiarItem(cuentaActiva.id, item.nombre, item.precio, item.categoria ?? "");
      }
    }
    setModal(null);
    setMetodoPago("efectivo");
    setCobrando(false);
  }

  async function handleCerrarDia() {
    if (cerrandoDia) return;
    setCerrandoDia(true);
    for (const cuenta of cuentas) {
      await limpiarCuenta(cuenta.id);
      await eliminarCuenta(cuenta.id);
    }
    await cerrarDia();
    await cerrarTurno();
    setIdActiva(null);
    setConfirmandoCierre(false);
    setModal(null);
    setCerrandoDia(false);
  }

  // ── Cobro rápido ──────────────────────────────────────────

  function agregarItemRapido(nombre: string, precio: number, categoria?: string) {
    setItemsRapidos((prev) => {
      const existe = prev.find((i) => claveItem(i.nombre, i.precio, i.categoria) === claveItem(nombre, precio, categoria));
      if (existe) return prev.map((i) => claveItem(i.nombre, i.precio, i.categoria) === claveItem(nombre, precio, categoria) ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { nombre, precio, cantidad: 1, ...(categoria ? { categoria } : {}) }];
    });
  }

  function restarItemRapido(nombre: string, precio: number, categoria?: string) {
    setItemsRapidos((prev) =>
      prev.map((i) => claveItem(i.nombre, i.precio, i.categoria) === claveItem(nombre, precio, categoria) ? { ...i, cantidad: i.cantidad - 1 } : i)
          .filter((i) => i.cantidad > 0)
    );
  }

  async function handleCobrarRapido() {
    if (cobrando || itemsRapidos.length === 0) return;
    setCobrando(true);
    const nombre = nombreRapido.trim() || "Rápido";
    const tieneCocina = itemsRapidos.some(esItemCocina);
    if (tieneCocina) {
      const now = new Date().toISOString();
      const itemsConTs = itemsRapidos.map((i) => ({ ...i, added_at: now }));
      const nueva = await crearCuenta(nombre);
      if (nueva) {
        await actualizarCuenta(nueva.id, itemsConTs);
        await cobrarCuenta({ ...nueva, items: itemsConTs, total: totalRapido }, sesion?.id ?? "sin-sesion", undefined, undefined, metodoPago);
        await marcarPagada(nueva.id);
      }
    } else {
      const cuentaFake: Cuenta = {
        id: "rapido",
        nombre,
        items: itemsRapidos,
        total: totalRapido,
        created_at: new Date().toISOString(),
      };
      await cobrarCuenta(cuentaFake, sesion?.id ?? "sin-sesion", undefined, undefined, metodoPago);
    }
    setItemsRapidos([]);
    setNombreRapido("");
    setModal(null);
    setMetodoPago("efectivo");
    setCobrando(false);
  }

  // Corregir el método de pago de un cobro ya guardado (p.ej. el camarero
  // se equivocó al marcarlo). Se edita desde el ticket, viendo el cobro
  // desde el Historial.
  async function handleCambiarMetodoPagoCobro(m: MetodoPago) {
    if (!cobroParaTicket || cobroParaTicket.metodo_pago === m) return;
    const ok = await actualizarMetodoPago(cobroParaTicket.id, m);
    if (ok) setCobroParaTicket((prev) => (prev ? { ...prev, metodo_pago: m } : prev));
  }

  // ── Backup / Exportar / Restaurar ────────────────────────

  function handleExportar() {
    const data = { exportado: new Date().toISOString(), sesion, cuentas: cuentas.filter(c => !c.pagada), cobros, totalDia };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fecha = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
    a.download = `timbre-${fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestaurar() {
    let backup: { cuentas: Cuenta[]; cobros: Cobro[]; timestamp: string } | null = null;
    // 1. Intentar localStorage
    try {
      const raw = localStorage.getItem("timbre-backup-v1");
      if (raw) backup = JSON.parse(raw);
    } catch {}
    // 2. Si no hay, tirar de Supabase
    if (!backup) {
      const { data } = await supabase.from("backups").select("datos").eq("id", "ultimo").maybeSingle();
      if (data?.datos) backup = data.datos;
    }
    if (!backup) return;
    // No recrear cuentas que ya están abiertas con ese nombre (evita duplicar
    // cuentas si se pulsa Restaurar más de una vez o el backup está desfasado).
    const nombresAbiertas = new Set(cuentas.filter((c) => !c.pagada).map((c) => c.nombre));
    for (const c of (backup.cuentas ?? [])) {
      if (c.pagada || nombresAbiertas.has(c.nombre)) continue;
      const nueva = await crearCuenta(c.nombre);
      if (nueva && c.items?.length) await actualizarCuenta(nueva.id, c.items);
      if (nueva && c.cobrado_parcial) await abonarCuenta(nueva.id, c.cobrado_parcial);
    }
    // restaurarCobros hace upsert por id, así que aunque se repita no duplica.
    if (backup.cobros?.length) await restaurarCobros(backup.cobros);
  }

  // ── Lista de compra ───────────────────────────────────────

  function agregarItemCompra() {
    if (!nuevoItemCompra.trim()) return;
    usuarioEditoCompra.current = true;
    setListaCompra((prev) => [...prev, { texto: nuevoItemCompra.trim(), hecho: false }]);
    setNuevoItemCompra("");
    setTimeout(() => inputCompraRef.current?.focus(), 50);
  }

  function toggleItemCompra(idx: number) {
    usuarioEditoCompra.current = true;
    setListaCompra((prev) => prev.map((item, j) => j === idx ? { ...item, hecho: !item.hecho } : item));
  }

  function eliminarItemCompra(idx: number) {
    usuarioEditoCompra.current = true;
    setListaCompra((prev) => prev.filter((_, j) => j !== idx));
  }

  function borrarCompletados() {
    usuarioEditoCompra.current = true;
    setListaCompra((prev) => prev.filter((item) => !item.hecho));
  }

  // ── Juntar cuentas ────────────────────────────────────────

  async function handleJuntarCuentas() {
    // No añadir artículos sin cobrar a una cuenta que ya fue cobrada (p.ej.
    // desde otro dispositivo): quedarían pendientes de cocina pero nunca se facturarían.
    if (!cuentaActiva || !idCuentaJuntar || cobrando || cuentaActiva.pagada) return;
    const cuentaFuente = cuentas.find((c) => c.id === idCuentaJuntar);
    if (!cuentaFuente) return;
    setCobrando(true);
    const now = new Date().toISOString();
    const itemsMerged = [...cuentaActiva.items];
    // Servidos a trasladar a la cuenta destino (nombre/precio/categoría ya
    // servidos en la fuente, para que no se dupliquen en cocina).
    const servidasDestino: { nombre: string; precio: number; categoria: string; cantidad: number }[] = [];
    for (const item of cuentaFuente.items) {
      // La cantidad completa se traslada siempre (para no perder artículos
      // ya servidos del ticket); solo la parte pendiente afecta a cocina.
      const servidaFuenteCantidad = servidas.find((s) => s.cuenta_id === idCuentaJuntar && claveItem(s.item_nombre, s.precio, s.categoria) === claveItem(item.nombre, item.precio, item.categoria))?.cantidad_servida ?? 0;
      const pendienteFuente = item.cantidad - servidaFuenteCantidad;
      const existente = itemsMerged.find((i) => claveItem(i.nombre, i.precio, i.categoria) === claveItem(item.nombre, item.precio, item.categoria));
      if (existente) {
        // Si la línea que ya tenía la cuenta destino estaba totalmente
        // servida, las unidades pendientes que llegan de la fuente son un
        // pedido nuevo: resetear added_at para que no se cuelen al
        // principio de cocina (mismo caso que handleAgregar/handleSumar).
        const servidaDestinoCantidad = servidas.find((s) => s.cuenta_id === cuentaActiva.id && claveItem(s.item_nombre, s.precio, s.categoria) === claveItem(item.nombre, item.precio, item.categoria))?.cantidad_servida ?? 0;
        const destinoTodoServido = servidaDestinoCantidad >= existente.cantidad;
        existente.cantidad += item.cantidad;
        if (pendienteFuente > 0 && destinoTodoServido) existente.added_at = now;
        if (servidaFuenteCantidad > 0) servidasDestino.push({ nombre: item.nombre, precio: item.precio, categoria: item.categoria ?? "", cantidad: servidaDestinoCantidad + servidaFuenteCantidad });
      } else {
        itemsMerged.push({ ...item });
        if (servidaFuenteCantidad > 0) servidasDestino.push({ nombre: item.nombre, precio: item.precio, categoria: item.categoria ?? "", cantidad: servidaFuenteCantidad });
      }
    }
    await actualizarCuenta(cuentaActiva.id, itemsMerged);
    for (const s of servidasDestino) await servirTodo(cuentaActiva.id, s.nombre, s.precio, s.categoria, s.cantidad);
    await limpiarCuenta(idCuentaJuntar);
    await eliminarCuenta(idCuentaJuntar);
    setIdCuentaJuntar(null);
    setModal(null);
    setCobrando(false);
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col bg-gray-50 text-gray-900 overflow-hidden select-none relative"
         style={{ height: "100dvh" }}>

      {/* ── Aviso de error de red/Supabase ── */}
      {toastError && (
        <div
          className="absolute left-3 right-3 z-[200] flex items-start gap-2 bg-red-600 text-white rounded-2xl px-4 py-3 shadow-2xl"
          style={{ top: "max(env(safe-area-inset-top), 0.75rem)" }}
        >
          <span className="text-lg leading-none shrink-0">⚠</span>
          <p className="flex-1 text-sm leading-snug">{toastError}</p>
          <button
            onClick={() => setToastError(null)}
            className="shrink-0 text-white/80 active:text-white text-sm touch-manipulation"
          >
            ✕
          </button>
        </div>
      )}

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
              sesion.turno === "mañana" ? "bg-amber-500/15 text-amber-600 border border-amber-500/25" : "bg-indigo-500/15 text-indigo-600 border border-indigo-500/25"
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
            className="relative shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-500 touch-manipulation"
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
            onClick={() => { setConfirmandoCierre(false); setCobroParaTicket(null); setModal("historial"); }}
            title="Historial"
            className="relative shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-500 touch-manipulation"
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
              <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="flex-1 text-left text-sm font-medium truncate">
                {loading ? "…" : (cuentaActiva?.nombre ?? "Seleccionar cuenta")}
              </span>
              {cuentaActiva && (
                <span className="text-amber-600 text-sm font-semibold tabular-nums shrink-0">{cuentaActiva.total.toFixed(2)}€</span>
              )}
              <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${mostrandoDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {mostrandoDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setMostrandoDropdown(false); setCreando(false); setNuevoNombre(""); }} />
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-gray-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ minWidth: "260px", maxHeight: "65dvh" }}>
                  <div className="overflow-y-auto flex-1" ref={dropdownListRef}>
                    {cuentasAbiertas.length === 0 && !creando && (
                      <p className="text-gray-500 text-sm text-center py-4">Sin cuentas abiertas</p>
                    )}
                    {cuentasAbiertas.map((c) => (
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
                      <button onClick={() => setCreando(true)} className="w-full py-2.5 text-sm text-gray-500 active:bg-gray-100 rounded-xl touch-manipulation text-center">
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
            onClick={() => { setCategoriaRapida(CATEGORIAS[0]); setItemsRapidos([]); setNombreRapido(""); setMetodoPago("efectivo"); setModal("cobro-rapido"); }}
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
            className="shrink-0 relative flex items-center justify-center w-11 h-11 rounded-xl bg-gray-100 active:bg-gray-200 text-gray-500 touch-manipulation border border-gray-300/50"
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
            className={`flex-1 py-3 text-sm font-semibold transition-colors touch-manipulation ${vistaMovil === v ? "text-amber-600 border-b-2 border-amber-400" : "text-gray-500"}`}>
            {v === "ticket" && cuentaActiva ? `Ticket · ${cuentaActiva.total.toFixed(2)}€` : v === "carta" ? "Carta" : "Ticket"}
          </button>
        ))}
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT: Ticket ── */}
        <div className={`${vistaMovil === "ticket" ? "flex" : "hidden"} md:flex flex-col w-full md:w-72 lg:w-80 shrink-0 border-r border-gray-200`}>
          {!cuentaActiva ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-500 text-sm p-6 text-center leading-relaxed">
              <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
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
                  onClick={() => setConfirmandoBorrar(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm touch-manipulation transition-colors bg-gray-100 text-gray-500 active:text-red-600"
                >
                  🗑
                </button>
              </div>

              {/* ── Lista de items ── */}
              <div className="flex-1 overflow-y-auto scroll-touch p-3 flex flex-col gap-2">
                {cuentaActiva.items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 text-gray-400 py-10">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-gray-500 text-sm">Sin artículos todavía</p>
                  </div>
                ) : (
                  cuentaActiva.items.map((item) => (
                    <div key={claveItem(item.nombre, item.precio, item.categoria)} className="flex items-center gap-1.5 bg-white rounded-xl px-2 py-2.5">
                      <span className="flex-1 text-sm font-medium leading-tight min-w-0 truncate">
                        {item.nombre}
                        {item.categoria && CATS_COCINA.includes(item.categoria) && (
                          <span className="ml-1.5 text-[10px] font-semibold text-gray-500">
                            ({item.categoria === "Montaditos" ? "montadito" : "tapa"})
                          </span>
                        )}
                      </span>
                      <button onClick={() => handleRestar(item.nombre, item.precio, item.categoria)} className="w-8 h-8 rounded-full bg-gray-200 active:bg-red-200 font-bold text-sm shrink-0 touch-manipulation">−</button>
                      <span className="w-5 text-center text-sm tabular-nums shrink-0 font-semibold">{item.cantidad}</span>
                      <button onClick={() => handleSumar(item.nombre, item.precio, item.categoria)} className="w-8 h-8 rounded-full bg-gray-200 active:bg-green-200 font-bold text-sm shrink-0 touch-manipulation">+</button>
                      <span className="w-12 text-right text-xs text-amber-600 tabular-nums shrink-0 font-medium">{(item.precio * item.cantidad).toFixed(2)}€</span>
                      <button onClick={() => handleEliminarLinea(item.nombre, item.precio, item.categoria)} className="w-7 h-7 rounded-lg bg-gray-100 active:bg-red-100 text-gray-500 active:text-red-600 text-sm shrink-0 touch-manipulation">×</button>
                    </div>
                  ))
                )}
              </div>

              {/* ── Total + acciones ── */}
              <div className="shrink-0 border-t border-gray-200 p-3 flex flex-col gap-2 bg-gray-50"
                   style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
                <div className="flex justify-between items-baseline px-1">
                  <span className="text-gray-500 text-sm uppercase tracking-wider">Total</span>
                  <span className="text-3xl font-bold text-amber-600 tabular-nums">{cuentaActiva.total.toFixed(2)}€</span>
                </div>
                {(cuentaActiva.cobrado_parcial ?? 0) > 0 && (
                  <div className="flex justify-between items-center px-1 text-xs">
                    <span className="text-green-600 font-medium">Pagado {cuentaActiva.cobrado_parcial!.toFixed(2)}€</span>
                    <span className="text-amber-500 font-semibold">Pendiente {pendienteCuenta.toFixed(2)}€</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setMetodoPago("efectivo"); setModal("cobrar"); }} disabled={sinItems}
                    className="flex-1 py-4 bg-green-600 active:bg-green-700 disabled:opacity-25 disabled:cursor-not-allowed rounded-2xl font-bold text-white text-base touch-manipulation">
                    {(cuentaActiva.cobrado_parcial ?? 0) > 0 ? `Cobrar resto (${pendienteCuenta.toFixed(2)}€)` : "Cobrar todo"}
                  </button>
                  <button onClick={abrirCobroParcial} disabled={sinItems}
                    className="py-4 px-4 bg-green-100 active:bg-green-200 disabled:opacity-25 disabled:cursor-not-allowed rounded-2xl font-semibold text-sm text-green-700 touch-manipulation">
                    Parcial
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setPersonas(2); setModal("dividir"); }} disabled={sinItems}
                    className="flex-1 py-3 bg-blue-700 active:bg-blue-800 disabled:opacity-25 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white touch-manipulation">
                    Dividir
                  </button>
                  <button onClick={() => { setEfectivo(""); setModal("cambio"); }} disabled={sinItems}
                    className="flex-1 py-3 bg-gray-200 active:bg-gray-300 disabled:opacity-25 disabled:cursor-not-allowed rounded-xl text-sm font-semibold touch-manipulation">
                    Cambio
                  </button>
                  <button
                    onClick={() => { setIdCuentaJuntar(null); setModal("juntar"); }}
                    disabled={cuentasParaJuntar.length === 0}
                    className="flex-1 py-3 bg-purple-100 active:bg-purple-200 disabled:opacity-25 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-purple-700 touch-manipulation"
                  >
                    Juntar
                  </button>
                </div>
                <button onClick={() => { setCobroParaTicket(null); setModal("ticket"); }} disabled={sinItems}
                  className="w-full py-2.5 bg-gray-100 active:bg-gray-200 disabled:opacity-25 border border-gray-300 rounded-xl text-sm text-gray-500 font-medium touch-manipulation">
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
                  categoria === cat ? "bg-amber-500 text-black" : "bg-gray-100 text-gray-500 active:bg-gray-200"
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
              className="w-full py-2.5 bg-gray-100 active:bg-gray-200 disabled:opacity-30 border border-dashed border-gray-400 rounded-xl text-sm text-gray-500 font-medium touch-manipulation"
            >
              + Importe libre
            </button>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto scroll-touch p-3"
               style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
            {!cuentaActiva ? (
              <div className="flex flex-col items-center gap-2 text-gray-400 py-16">
                <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-gray-500 text-sm">Crea una cuenta para añadir productos</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                {productosFiltrados.map((p) => (
                  <button key={p.id} onClick={() => handleAgregar(p.nombre, p.precio, p.categoria)}
                    className="flex flex-col items-center justify-center p-3 bg-gray-100 active:bg-gray-200 active:scale-95 rounded-2xl transition-transform touch-manipulation"
                    style={{ minHeight: "72px" }}>
                    <span className="text-sm font-semibold text-center leading-tight">{p.nombre}</span>
                    <span className="text-amber-600 text-xs mt-1 tabular-nums font-medium">{p.precio.toFixed(2)}€</span>
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

      {/* ── Modal: Borrar cuenta ── */}
      {confirmandoBorrar && cuentaActiva && (
        <BottomSheet>
          <div className="p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-center">¿Borrar cuenta?</h2>
            <p className="text-center text-gray-500">Se borrará «<span className="text-gray-900 font-semibold">{cuentaActiva.nombre}</span>» y todos sus artículos. Esta acción no se puede deshacer.</p>
            <button onClick={handleBorrarCuenta} className="w-full py-4 bg-red-600 active:bg-red-700 text-white rounded-2xl font-bold text-base touch-manipulation">
              Sí, borrar
            </button>
            <button onClick={() => setConfirmandoBorrar(false)} className="w-full py-3 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-500 touch-manipulation">Cancelar</button>
          </div>
        </BottomSheet>
      )}

      {/* ── Modal: Cobro rápido ── */}
      {modal === "cobro-rapido" && (
        <div className="fixed inset-0 bg-black/90 flex flex-col z-50"
             style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex-1 flex flex-col bg-white overflow-hidden">

            {/* Cabecera */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-bold">⚡ Cobro rápido</h2>
              <button onClick={() => { setModal(null); setItemsRapidos([]); setNombreRapido(""); }} className="w-9 h-9 rounded-full bg-gray-100 active:bg-gray-200 text-gray-500 touch-manipulation">✕</button>
            </div>
            {/* Nombre opcional */}
            <div className="shrink-0 px-3 pt-2 pb-1">
              <input
                value={nombreRapido}
                onChange={(e) => setNombreRapido(e.target.value)}
                placeholder="Nombre (opcional)…"
                className="w-full bg-gray-100 border border-gray-300 focus:border-amber-500 rounded-xl px-3 py-2.5 outline-none text-sm"
                style={{ fontSize: "16px" }}
              />
            </div>

            {/* Categorías */}
            <div className="shrink-0 flex gap-1.5 px-3 py-2 border-b border-gray-200 overflow-x-auto scroll-touch scrollbar-none">
              {CATEGORIAS.map((cat) => (
                <button key={cat} onClick={() => setCategoriaRapida(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold touch-manipulation ${
                    categoriaRapida === cat ? "bg-amber-500 text-black" : "bg-gray-100 text-gray-500 active:bg-gray-200"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Productos */}
            <div className="flex-1 overflow-y-auto scroll-touch p-3">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {productosRapidosFiltrados.map((p) => {
                  const cant = itemsRapidos.find((i) => claveItem(i.nombre, i.precio, i.categoria) === claveItem(p.nombre, p.precio, p.categoria))?.cantidad ?? 0;
                  return (
                    <button key={p.id} onClick={() => agregarItemRapido(p.nombre, p.precio, p.categoria)}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-2xl active:scale-95 transition-transform touch-manipulation ${
                        cant > 0 ? "bg-amber-100 border border-amber-400" : "bg-gray-100 active:bg-gray-200"
                      }`}
                      style={{ minHeight: "72px" }}>
                      {cant > 0 && (
                        <span className="absolute top-1.5 right-1.5 bg-amber-500 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                          {cant}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-center leading-tight">{p.nombre}</span>
                      <span className="text-amber-600 text-xs mt-1 tabular-nums font-medium">{p.precio.toFixed(2)}€</span>
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
                    <div key={claveItem(item.nombre, item.precio, item.categoria)} className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{item.nombre}</span>
                      <button onClick={() => restarItemRapido(item.nombre, item.precio, item.categoria)} className="w-7 h-7 rounded-full bg-gray-200 active:bg-red-200 font-bold text-sm shrink-0 touch-manipulation">−</button>
                      <span className="w-5 text-center text-sm tabular-nums font-bold shrink-0">{item.cantidad}</span>
                      <button onClick={() => agregarItemRapido(item.nombre, item.precio, item.categoria)} className="w-7 h-7 rounded-full bg-gray-200 active:bg-green-200 font-bold text-sm shrink-0 touch-manipulation">+</button>
                      <span className="w-14 text-right text-xs text-amber-600 tabular-nums shrink-0 font-medium">{(item.precio * item.cantidad).toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-4 py-3 flex flex-col gap-2">
                {itemsRapidos.length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-1">Toca un producto para añadirlo</p>
                )}
                <div className="flex justify-between items-baseline px-1">
                  <span className="text-gray-500 text-sm uppercase tracking-wider">Total</span>
                  <span className="text-2xl font-bold text-amber-600 tabular-nums">{totalRapido.toFixed(2)}€</span>
                </div>
                <div className="flex gap-1.5">
                  {(["efectivo", "tarjeta"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetodoPago(m)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold touch-manipulation ${
                        metodoPago === m ? "bg-amber-500 text-black" : "bg-gray-100 text-gray-500 active:bg-gray-200"
                      }`}
                    >
                      {m === "efectivo" ? "💶 Efectivo" : "💳 Tarjeta"}
                    </button>
                  ))}
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
        <BottomSheet maxWidth="md" maxHeight="85dvh">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
              <h2 className="text-xl font-bold">🛒 Lista de compra</h2>
              <button onClick={() => setModal(null)} className="w-9 h-9 rounded-full bg-gray-100 active:bg-gray-200 text-gray-500 text-sm touch-manipulation">✕</button>
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
                <div className="flex flex-col items-center gap-2 text-gray-400 py-10">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <p className="text-gray-500 text-sm">La lista está vacía</p>
                </div>
              ) : (
                listaCompra.map((item, idx) => (
                  <div key={idx} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${item.hecho ? "bg-gray-50" : "bg-gray-100"}`}>
                    <button
                      onClick={() => toggleItemCompra(idx)}
                      className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center touch-manipulation transition-colors ${
                        item.hecho
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-gray-400 active:bg-green-500 active:border-green-500"
                      }`}
                    >
                      {item.hecho && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${item.hecho ? "line-through text-gray-500" : "text-gray-900"}`}>{item.texto}</span>
                    <button onClick={() => eliminarItemCompra(idx)} className="w-6 h-6 flex items-center justify-center text-gray-300 active:text-red-600 touch-manipulation text-base shrink-0">×</button>
                  </div>
                ))
              )}
            </div>

            {/* Acciones */}
            <div className="shrink-0 border-t border-gray-200 px-4 pt-3 pb-4 flex flex-col gap-2">
              {listaCompra.some((i) => i.hecho) && (
                <button onClick={borrarCompletados} className="w-full py-3 bg-red-50 active:bg-red-100 text-red-500 rounded-xl text-sm font-semibold touch-manipulation">
                  Borrar completados
                </button>
              )}
              <button onClick={() => setModal(null)} className="w-full py-3 bg-gray-100 active:bg-gray-200 rounded-xl text-gray-500 touch-manipulation">Cerrar</button>
            </div>
        </BottomSheet>
      )}

      {/* ── Modal: Importe libre ── */}
      {modal === "libre" && cuentaActiva && (
        <BottomSheet>
          <div className="p-5 flex flex-col gap-3">
            <h2 className="text-xl font-bold text-center">Importe libre</h2>
            <input
              value={libreNombre}
              onChange={(e) => setLibreNombre(e.target.value)}
              placeholder="Descripción (opcional)"
              className="bg-gray-100 border border-gray-300 focus:border-amber-500 rounded-xl px-4 py-3 outline-none text-sm"
              style={{ fontSize: "16px" }}
            />
            <div className="flex gap-2">
              {["", "Montaditos", "Tapas"].map((cat) => (
                <button key={cat} type="button" onClick={() => setLibreCategoria(cat)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold touch-manipulation border transition-colors ${
                    libreCategoria === cat
                      ? cat === "Montaditos" ? "bg-amber-500 text-black border-amber-500"
                        : cat === "Tapas" ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-gray-900 text-white border-gray-900"
                      : "bg-gray-100 text-gray-500 border-gray-200"
                  }`}>
                  {cat === "" ? "Sin cocina" : cat === "Montaditos" ? "Montadito" : "Tapa"}
                </button>
              ))}
            </div>
            <div className="bg-gray-100 rounded-2xl px-4 py-3 text-right text-3xl font-bold tabular-nums min-h-[56px]">
              {libreImporte || "0"}€
            </div>
            <NumPad value={libreImporte} onChange={setLibreImporte} />
            <button onClick={handleAgregarLibre} disabled={!libreImporte || parseFloat(libreImporte) <= 0}
              className="w-full py-4 bg-amber-500 active:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-bold text-base touch-manipulation">
              Añadir al ticket
            </button>
            <button onClick={() => setModal(null)} className="w-full py-3 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-500 touch-manipulation">Cancelar</button>
          </div>
        </BottomSheet>
      )}

      {/* ── Modal: Ticket (vista previa o recibo ya cobrado) ── */}
      {modal === "ticket" && ticketData && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4"
             style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="w-full max-w-xs flex justify-end mb-3">
            <button onClick={() => { setModal(cobroParaTicket ? "historial" : null); setCobroParaTicket(null); }}
              className="w-8 h-8 rounded-full bg-gray-100 active:bg-gray-200 text-gray-500 text-sm touch-manipulation">
              ✕
            </button>
          </div>
          <div className="w-full max-w-xs bg-white text-gray-900 rounded-2xl overflow-hidden shadow-2xl"
               style={{ fontFamily: "ui-monospace, monospace" }}>
            <div className="text-center py-5 px-4 border-b border-dashed border-gray-300">
              <img src="/logo.jpg" alt="Cervecería El Timbre" className="h-16 w-auto mx-auto object-contain" />
              <p className="text-xs text-gray-500 mt-1">
                {ticketData.fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                {" · "}
                {ticketData.fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-sm font-semibold mt-2">{ticketData.nombre}</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-1.5">
              {ticketData.items.map((item) => (
                <div key={claveItem(item.nombre, item.precio, item.categoria)} className="flex justify-between items-baseline text-sm">
                  <span className="flex-1 truncate">{item.nombre}</span>
                  <span className="text-gray-500 text-xs mx-2 shrink-0">{item.cantidad}×{item.precio.toFixed(2)}</span>
                  <span className="font-semibold tabular-nums shrink-0">{(item.precio * item.cantidad).toFixed(2)}€</span>
                </div>
              ))}
            </div>
            <div className="mx-4 border-t border-dashed border-gray-300" />
            <div className="flex justify-between items-center px-4 py-3">
              <span className="font-bold text-base tracking-wider uppercase">Total</span>
              <span className="font-bold text-2xl tabular-nums">{ticketData.total.toFixed(2)}€</span>
            </div>
            {cobroParaTicket && (
              <div className="flex justify-center gap-1.5 px-4 pb-3">
                {(["efectivo", "tarjeta"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleCambiarMetodoPagoCobro(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold touch-manipulation ${
                      cobroParaTicket.metodo_pago === m ? "bg-amber-500 text-black" : "bg-gray-100 text-gray-500 active:bg-gray-200"
                    }`}
                  >
                    {m === "efectivo" ? "💶 Efectivo" : "💳 Tarjeta"}
                  </button>
                ))}
              </div>
            )}
            <div className="text-center py-3 border-t border-dashed border-gray-300">
              <p className="text-xs text-gray-500">¡Gracias por tu visita!</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Cobro parcial ── */}
      {modal === "parcial" && cuentaActiva && (
        <BottomSheet maxHeight="85dvh">
            <div className="px-5 pt-4 pb-3 shrink-0">
              <h2 className="text-xl font-bold">Cobro parcial</h2>
              <p className="text-gray-500 text-sm mt-0.5">{cuentaActiva.nombre} · pendiente {pendienteCuenta.toFixed(2)}€</p>
            </div>
            {/* Toggle Por artículos / Por importe */}
            <div className="shrink-0 flex gap-1.5 px-4 pb-3">
              {(["articulos", "importe"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setModoParcial(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold touch-manipulation ${
                    modoParcial === m ? "bg-amber-500 text-black" : "bg-gray-100 text-gray-500 active:bg-gray-200"
                  }`}
                >
                  {m === "articulos" ? "Por artículos" : "Por importe"}
                </button>
              ))}
            </div>
            {/* Toggle Efectivo / Tarjeta */}
            <div className="shrink-0 flex gap-1.5 px-4 pb-3">
              {(["efectivo", "tarjeta"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodoPago(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold touch-manipulation ${
                    metodoPago === m ? "bg-amber-500 text-black" : "bg-gray-100 text-gray-500 active:bg-gray-200"
                  }`}
                >
                  {m === "efectivo" ? "💶 Efectivo" : "💳 Tarjeta"}
                </button>
              ))}
            </div>

            {modoParcial === "articulos" ? (
              <>
                <div className="flex-1 overflow-y-auto scroll-touch px-4 flex flex-col gap-2 pb-2">
                  {seleccionParcial.map((linea, idx) => (
                    <div key={claveItem(linea.nombre, linea.precio, linea.categoria)} className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {linea.nombre}
                          {linea.categoria && CATS_COCINA.includes(linea.categoria) && (
                            <span className="ml-1.5 text-[10px] font-semibold text-gray-500">
                              ({linea.categoria === "Montaditos" ? "montadito" : "tapa"})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{linea.precio.toFixed(2)}€/u · hay {linea.max}</p>
                      </div>
                      <button
                        onClick={() => setSeleccionParcial((prev) => prev.map((l, i) => i === idx ? { ...l, cobrar: Math.max(0, l.cobrar - 1) } : l))}
                        className="w-8 h-8 rounded-full bg-gray-200 active:bg-red-200 font-bold text-sm shrink-0 touch-manipulation"
                      >−</button>
                      <span className={`w-6 text-center text-sm tabular-nums font-bold shrink-0 ${linea.cobrar === 0 ? "text-gray-500" : "text-gray-900"}`}>
                        {linea.cobrar}
                      </span>
                      <button
                        onClick={() => setSeleccionParcial((prev) => prev.map((l, i) => i === idx ? { ...l, cobrar: Math.min(l.max, l.cobrar + 1) } : l))}
                        className="w-8 h-8 rounded-full bg-gray-200 active:bg-green-200 font-bold text-sm shrink-0 touch-manipulation"
                      >+</button>
                      <span className={`w-14 text-right text-sm tabular-nums shrink-0 font-medium ${linea.cobrar === 0 ? "text-gray-500" : "text-amber-600"}`}>
                        {(linea.precio * linea.cobrar).toFixed(2)}€
                      </span>
                    </div>
                  ))}
                </div>
                <div className="shrink-0 border-t border-gray-200 px-5 py-3 flex justify-between items-baseline">
                  <span className="text-gray-500 text-sm uppercase tracking-wider">A cobrar</span>
                  <span className="text-2xl font-bold text-amber-600 tabular-nums">
                    {totalSeleccion(seleccionParcial).toFixed(2)}€
                  </span>
                </div>
                <div className="shrink-0 px-4 pb-4 flex flex-col gap-2">
                  <button
                    onClick={handleCobrarParcial}
                    disabled={cobrando || seleccionParcial.every((l) => l.cobrar === 0)}
                    className="w-full py-4 bg-green-600 active:bg-green-700 disabled:opacity-30 rounded-2xl font-bold text-white text-base touch-manipulation"
                  >
                    {cobrando ? "Guardando…" : `Cobrar ${totalSeleccion(seleccionParcial).toFixed(2)}€`}
                  </button>
                  <button onClick={() => setModal(null)} className="w-full py-3 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-500 touch-manipulation">Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto scroll-touch px-4 pb-2 flex flex-col gap-3">
                  <p className="text-xs text-gray-500 text-center">
                    No mueve artículos del ticket — cocina sigue viendo lo mismo. Solo lleva la cuenta de cuánto se ha pagado ya.
                  </p>
                  <div className="bg-gray-100 rounded-2xl px-4 py-3 text-right text-3xl font-bold tabular-nums min-h-[56px]">
                    {importeParcial || "0"}€
                  </div>
                  <NumPad value={importeParcial} onChange={setImporteParcial} />
                  {superaPendiente(parsearImporte(importeParcial), pendienteCuenta) && (
                    <p className="text-center text-xs text-red-600">No puede superar lo pendiente ({pendienteCuenta.toFixed(2)}€)</p>
                  )}
                </div>
                <div className="shrink-0 px-4 pb-4 flex flex-col gap-2">
                  <button
                    onClick={handleCobrarPorImporte}
                    disabled={cobrando || !esImporteParcialValido(parsearImporte(importeParcial), pendienteCuenta)}
                    className="w-full py-4 bg-green-600 active:bg-green-700 disabled:opacity-30 rounded-2xl font-bold text-white text-base touch-manipulation"
                  >
                    {cobrando ? "Guardando…" : `Cobrar ${parsearImporte(importeParcial).toFixed(2)}€ a cuenta`}
                  </button>
                  <button onClick={() => setModal(null)} className="w-full py-3 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-500 touch-manipulation">Cancelar</button>
                </div>
              </>
            )}
        </BottomSheet>
      )}

      {/* ── Modal: Cobrar ── */}
      {modal === "cobrar" && cuentaActiva && (
        <BottomSheet>
          <div className="p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-center">Cobrar cuenta</h2>
            <p className="text-center text-gray-500 font-medium">{cuentaActiva.nombre}</p>
            {(cuentaActiva.cobrado_parcial ?? 0) > 0 && (
              <p className="text-center text-xs text-gray-500">
                Total {cuentaActiva.total.toFixed(2)}€ · ya pagado {cuentaActiva.cobrado_parcial!.toFixed(2)}€
              </p>
            )}
            <p className="text-center text-5xl font-bold text-amber-600 tabular-nums py-2">{pendienteCuenta.toFixed(2)}€</p>
            <div className="flex gap-1.5">
              {(["efectivo", "tarjeta"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodoPago(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold touch-manipulation ${
                    metodoPago === m ? "bg-amber-500 text-black" : "bg-gray-100 text-gray-500 active:bg-gray-200"
                  }`}
                >
                  {m === "efectivo" ? "💶 Efectivo" : "💳 Tarjeta"}
                </button>
              ))}
            </div>
            <button onClick={handleCobrar} disabled={cobrando}
              className="w-full py-4 bg-green-600 active:bg-green-700 disabled:opacity-50 rounded-2xl font-bold text-white text-lg touch-manipulation">
              {cobrando ? "Guardando…" : "Confirmar cobro"}
            </button>
            <button onClick={() => setModal(null)} className="w-full py-4 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-500 touch-manipulation">Cancelar</button>
          </div>
        </BottomSheet>
      )}

      {/* ── Modal: Dividir ── */}
      {modal === "dividir" && cuentaActiva && (
        <BottomSheet>
          <div className="p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-center">Dividir cuenta</h2>
            <p className="text-center text-gray-500">Total: <span className="text-gray-900 font-semibold">{cuentaActiva.total.toFixed(2)}€</span></p>
            <div className="flex items-center justify-center gap-6 py-2">
              <button onClick={() => setPersonas((p) => Math.max(2, p - 1))} className="w-14 h-14 rounded-full bg-gray-200 active:bg-gray-300 text-2xl font-bold touch-manipulation">−</button>
              <span className="text-4xl font-bold w-12 text-center tabular-nums">{personas}</span>
              <button onClick={() => setPersonas((p) => p + 1)} className="w-14 h-14 rounded-full bg-gray-200 active:bg-gray-300 text-2xl font-bold touch-manipulation">+</button>
            </div>
            <p className="text-center text-gray-500 text-sm">{personas} personas</p>
            <div className="bg-gray-100 rounded-2xl p-5 text-center">
              <p className="text-gray-500 text-sm mb-1 uppercase tracking-wider">Cada uno paga</p>
              <p className="text-5xl font-bold text-amber-600 tabular-nums">{importePorPersona(cuentaActiva.total, personas).toFixed(2)}€</p>
            </div>
            <button onClick={() => setModal(null)} className="w-full py-4 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-500 touch-manipulation">Cerrar</button>
          </div>
        </BottomSheet>
      )}

      {/* ── Modal: Cambio ── */}
      {modal === "cambio" && cuentaActiva && (
        <BottomSheet>
          <div className="p-5 flex flex-col gap-3">
            <h2 className="text-xl font-bold text-center">Calcular cambio</h2>
            <p className="text-center text-gray-500">Total: <span className="text-gray-900 font-semibold">{cuentaActiva.total.toFixed(2)}€</span></p>
            <div className="bg-gray-100 rounded-2xl px-4 py-3 text-right text-3xl font-bold tabular-nums min-h-[56px]">{efectivo || "0"}€</div>
            <NumPad value={efectivo} onChange={setEfectivo} />
            {parsearImporte(efectivo) > 0 && (
              <div className="bg-gray-100 rounded-2xl p-4 text-center">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Cambio</p>
                <p className={`text-4xl font-bold tabular-nums ${cambio >= 0 ? "text-green-600" : "text-red-600"}`}>{cambio.toFixed(2)}€</p>
              </div>
            )}
            <button onClick={() => setModal(null)} className="w-full py-4 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-500 touch-manipulation">Cerrar</button>
          </div>
        </BottomSheet>
      )}

      {/* ── Modal: Juntar cuentas ── */}
      {modal === "juntar" && cuentaActiva && (
        <BottomSheet maxHeight="75dvh">
            <div className="px-5 pt-4 pb-2 shrink-0">
              <h2 className="text-xl font-bold">Juntar con…</h2>
              <p className="text-gray-500 text-sm mt-0.5">Los artículos se añadirán a <span className="text-gray-900 font-semibold">«{cuentaActiva.nombre}»</span></p>
            </div>
            <div className="flex-1 overflow-y-auto scroll-touch px-4 py-2 flex flex-col gap-2">
              {cuentasParaJuntar.length === 0 ? (
                <div className="flex flex-col items-center gap-2 text-gray-400 py-8">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500 text-sm">No hay otras cuentas abiertas</p>
                </div>
              ) : (
                cuentasParaJuntar.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setIdCuentaJuntar(c.id === idCuentaJuntar ? null : c.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 touch-manipulation transition-colors ${
                      c.id === idCuentaJuntar
                        ? "bg-purple-500 border-purple-500 text-white"
                        : "bg-gray-100 border-gray-200 active:border-gray-400 text-gray-500"
                    }`}
                  >
                    <span className="font-semibold text-sm">{c.nombre}</span>
                    <span className={`tabular-nums text-sm ${c.id === idCuentaJuntar ? "text-white" : "text-amber-600"}`}>{c.total.toFixed(2)}€</span>
                  </button>
                ))
              )}
            </div>
            <div className="shrink-0 border-t border-gray-200 px-4 pt-3 pb-4 flex flex-col gap-2">
              <button
                onClick={handleJuntarCuentas}
                disabled={!idCuentaJuntar || cobrando}
                className="w-full py-4 bg-purple-700 active:bg-purple-600 disabled:opacity-30 text-white rounded-2xl font-bold text-base touch-manipulation"
              >
                {cobrando ? "Juntando…" : idCuentaJuntar
                  ? `Juntar con «${cuentas.find((c) => c.id === idCuentaJuntar)?.nombre}»`
                  : "Selecciona una cuenta"}
              </button>
              <button onClick={() => { setModal(null); setIdCuentaJuntar(null); }} className="w-full py-3 bg-gray-100 active:bg-gray-200 rounded-2xl text-gray-500 touch-manipulation">Cancelar</button>
            </div>
        </BottomSheet>
      )}

      {/* ── Modal: Historial ── */}
      {modal === "historial" && (
        <BottomSheet maxWidth="md" maxHeight="85dvh">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
              <h2 className="text-xl font-bold">Historial del día</h2>
              <button onClick={() => { setModal(null); setConfirmandoCierre(false); setConfirmandoCierreTurno(false); setConfirmandoRestaurar(false); }} className="w-9 h-9 rounded-full bg-gray-100 active:bg-gray-200 text-gray-500 text-sm touch-manipulation">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto scroll-touch px-4 pb-2 flex flex-col gap-3">
              {cobros.length === 0 ? (
                <div className="flex flex-col items-center gap-2 text-gray-400 py-10">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-500 text-sm">No hay cuentas cobradas aún</p>
                </div>
              ) : (() => {
                // Extraer sesiones únicas con su timestamp de inicio real
                const sesionesMap = new Map<string, { turno: string; startTime: number }>();
                for (const cobro of cobros) {
                  const sid = cobro.sesion_id ?? "sin-sesion";
                  if (!sesionesMap.has(sid)) {
                    let turno = "mañana";
                    let startTime = 0;
                    if (sid.startsWith("mañana-")) { turno = "mañana"; startTime = parseInt(sid.replace("mañana-", "")); }
                    else if (sid.startsWith("tarde-")) { turno = "tarde"; startTime = parseInt(sid.replace("tarde-", "")); }
                    sesionesMap.set(sid, { turno, startTime });
                  }
                }
                // Ordenar sesiones por hora de inicio
                const sesionesOrdenadas = Array.from(sesionesMap.entries())
                  .sort(([, a], [, b]) => a.startTime - b.startTime);

                // Asignar cada cobro a la sesión correcta por su hora real (no por sesion_id guardado)
                const grupos = sesionesOrdenadas.map(([sid, info], i) => {
                  const nextStart = i + 1 < sesionesOrdenadas.length ? sesionesOrdenadas[i + 1][1].startTime : Infinity;
                  return {
                    id: sid,
                    turno: info.turno,
                    startTime: info.startTime,
                    cobros: cobros.filter((c) => {
                      const t = new Date(c.created_at).getTime();
                      return t >= info.startTime && t < nextStart;
                    }),
                  };
                }).filter((g) => g.cobros.length > 0);

                return grupos.map((sesion) => {
                  const { total: totalSesion, efectivo: efectivoSesion, tarjeta: tarjetaSesion } = desglosePorMetodo(sesion.cobros);
                  const etiqueta = sesion.turno === "mañana" ? "Turno de Mañana" : "Turno de Tarde";
                  const colorEtiqueta = sesion.turno === "mañana" ? "text-orange-600" : "text-indigo-600";
                  const timestamp = sesion.startTime || null;
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
                        {sesion.cobros.map((cobro) => (
                          <button
                            key={cobro.id}
                            onClick={() => { setCobroParaTicket(cobro); setModal("ticket"); }}
                            className="w-full flex items-start justify-between gap-3 px-4 py-3 bg-gray-100 rounded-2xl touch-manipulation active:bg-gray-200 text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{cobro.nombre_cuenta}</p>
                              <p className="text-gray-500 text-xs mt-0.5">
                                {new Date(cobro.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                {" · "}
                                {cobro.items.length} artículo{cobro.items.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs" title={cobro.metodo_pago === "tarjeta" ? "Tarjeta" : "Efectivo"}>
                                {cobro.metodo_pago === "tarjeta" ? "💳" : "💶"}
                              </span>
                              <span className="text-amber-600 font-bold tabular-nums">{Number(cobro.total).toFixed(2)}€</span>
                              <span className="text-gray-500 text-xs">🧾</span>
                            </div>
                          </button>
                        ))}
                        <div className="flex justify-between px-1 py-1 text-xs text-gray-500">
                          <span>{sesion.cobros.length} cobro{sesion.cobros.length !== 1 ? "s" : ""} · 💶{efectivoSesion.toFixed(2)}€ · 💳{tarjetaSesion.toFixed(2)}€</span>
                          <span className="font-semibold text-gray-500">{totalSesion.toFixed(2)}€</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="shrink-0 border-t border-gray-200 px-4 py-3 flex items-center gap-3">
              {/* Caja editable */}
              <div className="flex-1 flex items-center gap-2">
                {editandoCaja ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-xs text-gray-500 shrink-0">Caja:</span>
                    <input
                      autoFocus
                      type="number"
                      inputMode="decimal"
                      value={cajaEditada}
                      onChange={(e) => setCajaEditada(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          actualizarCaja(parseFloat(cajaEditada) || 0);
                          setEditandoCaja(false);
                        }
                        if (e.key === "Escape") setEditandoCaja(false);
                      }}
                      placeholder="0.00"
                      className="w-24 bg-gray-100 border border-amber-400 rounded-lg px-2 py-1 text-sm font-semibold outline-none tabular-nums"
                      style={{ fontSize: "16px" }}
                    />
                    <span className="text-xs text-gray-500">€</span>
                    <button
                      onClick={() => { actualizarCaja(parseFloat(cajaEditada) || 0); setEditandoCaja(false); }}
                      className="text-xs px-2 py-1 bg-amber-500 text-black rounded-lg font-semibold touch-manipulation"
                    >OK</button>
                    <button onClick={() => setEditandoCaja(false)} className="text-xs text-gray-500 touch-manipulation">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setCajaEditada(sesion ? String(sesion.caja_inicio) : "0"); setEditandoCaja(true); }}
                    className="flex items-center gap-1.5 text-left touch-manipulation group"
                  >
                    <span className="text-xs text-gray-500">Caja:</span>
                    <span className="text-sm font-semibold text-gray-600 tabular-nums">{Number(sesion?.caja_inicio ?? 0).toFixed(2)}€</span>
                    <span className="text-[10px] text-gray-300 group-active:text-gray-500">✏</span>
                  </button>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">{cobros.length} cobro{cobros.length !== 1 ? "s" : ""}</p>
                <span className="text-2xl font-bold text-amber-600 tabular-nums">{totalDia.toFixed(2)}€</span>
                <p className="text-[10px] text-gray-500 tabular-nums mt-0.5">💶 {totalEfectivoDia.toFixed(2)}€ · 💳 {totalTarjetaDia.toFixed(2)}€</p>
              </div>
            </div>
            {/* Backup info */}
            {backupTimestamp && (
              <div className="shrink-0 px-4 pb-1 flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">
                  Copia: {new Date(backupTimestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="flex gap-2">
                  <button onClick={handleExportar} className="text-xs px-3 py-1.5 bg-gray-100 active:bg-gray-200 rounded-lg text-gray-500 touch-manipulation font-medium">
                    Exportar JSON
                  </button>
                  <button onClick={() => setConfirmandoRestaurar(true)} disabled={restaurando} className="text-xs px-3 py-1.5 bg-amber-100 active:bg-amber-200 disabled:opacity-50 rounded-lg text-amber-700 touch-manipulation font-medium">
                    Restaurar
                  </button>
                </div>
              </div>
            )}
            <div className="shrink-0 px-4 pt-1 pb-4 flex flex-col gap-2">
              {!confirmandoCierre && !confirmandoCierreTurno && !confirmandoRestaurar && (
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
                  <button onClick={() => setConfirmandoCierre(true)} className="w-full py-3.5 bg-red-50 active:bg-red-100 text-red-600 rounded-2xl text-sm font-semibold touch-manipulation">Cerrar día</button>
                </>
              )}
              {confirmandoRestaurar && (
                <>
                  <p className="text-center text-sm text-gray-500 pb-1">
                    ¿Restaurar la última copia de seguridad{backupTimestamp ? ` (${new Date(backupTimestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })})` : ""}?
                  </p>
                  <button
                    onClick={async () => {
                      setRestaurando(true);
                      await handleRestaurar();
                      setRestaurando(false);
                      setConfirmandoRestaurar(false);
                    }}
                    disabled={restaurando}
                    className="w-full py-4 bg-amber-500 active:bg-amber-600 disabled:opacity-50 text-black rounded-2xl text-sm font-bold touch-manipulation"
                  >
                    {restaurando ? "Restaurando…" : "Sí, restaurar"}
                  </button>
                  <button onClick={() => setConfirmandoRestaurar(false)} disabled={restaurando} className="w-full py-3 bg-gray-100 active:bg-gray-200 disabled:opacity-50 text-gray-500 rounded-2xl text-sm touch-manipulation">Cancelar</button>
                </>
              )}
              {confirmandoCierreTurno && (
                <>
                  <p className="text-center text-sm text-gray-500 pb-1">Se cerrará el turno y se pedirá el siguiente al abrir la app.</p>
                  <button
                    onClick={async () => { await cerrarTurno(); setConfirmandoCierreTurno(false); setModal(null); }}
                    className="w-full py-4 bg-gray-200 active:bg-gray-300 text-gray-700 rounded-2xl text-sm font-bold touch-manipulation"
                  >
                    Sí, cerrar turno
                  </button>
                  <button onClick={() => setConfirmandoCierreTurno(false)} className="w-full py-3 bg-gray-100 active:bg-gray-200 text-gray-500 rounded-2xl text-sm touch-manipulation">Cancelar</button>
                </>
              )}
              {confirmandoCierre && (
                <>
                  <p className="text-center text-sm text-gray-500 pb-1">¿Seguro? Se borrará todo el historial de hoy.</p>
                  {cuentas.length > 0 && (
                    <p className="text-center text-sm text-red-600 font-semibold pb-1">
                      ⚠ Hay {cuentas.length} cuenta{cuentas.length !== 1 ? "s" : ""} abierta{cuentas.length !== 1 ? "s" : ""} — también se eliminarán.
                    </p>
                  )}
                  <button onClick={handleCerrarDia} disabled={cerrandoDia} className="w-full py-4 bg-red-600 active:bg-red-700 disabled:opacity-50 text-white rounded-2xl text-sm font-bold touch-manipulation">
                    {cerrandoDia ? "Cerrando…" : "Sí, cerrar y borrar historial"}
                  </button>
                  <button onClick={() => setConfirmandoCierre(false)} disabled={cerrandoDia} className="w-full py-4 bg-gray-100 active:bg-gray-200 disabled:opacity-50 text-gray-500 rounded-2xl text-sm touch-manipulation">Cancelar</button>
                </>
              )}
            </div>
        </BottomSheet>
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
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
                <svg className="w-14 h-14 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-sm">Todo servido</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {pedidosPendientes.map(({ cuentaId, cuentaNombre, item, pendiente, categoria, pagada }) => (
                  <div key={`${cuentaId}-${claveItem(item.nombre, item.precio, categoria)}`} className={`bg-white rounded-2xl border shadow-sm flex items-center gap-3 px-4 py-3 ${pagada ? "border-green-300" : "border-gray-200"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-gray-900">{cuentaNombre}</p>
                        {pagada && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">Pagada</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          categoria === "Montaditos" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                        }`}>
                          {categoria === "Montaditos" ? "Montadito" : "Tapa"}
                        </span>
                        <span className="text-base font-semibold text-gray-800">{item.nombre}</span>
                      </div>
                    </div>
                    <span className="text-xl font-bold text-gray-700 tabular-nums w-8 text-center shrink-0">×{pendiente}</span>
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => servirUno(cuentaId, item.nombre, item.precio, categoria)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 text-gray-700 touch-manipulation text-xl font-bold">−</button>
                      <button type="button" onClick={() => servirTodo(cuentaId, item.nombre, item.precio, categoria, item.cantidad)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-500 active:bg-green-600 text-white touch-manipulation">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
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
            <p className="text-gray-500 text-sm mt-1">
              {loadingSesion ? "Cargando…" : turnoSeleccionado ? "¿Cuánto hay en caja?" : "¿Qué turno empieza ahora?"}
            </p>
          </div>

          {loadingSesion ? (
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          ) : turnoSeleccionado ? (
            /* Paso 2: introducir caja de inicio */
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold ${
                turnoSeleccionado === "mañana" ? "bg-amber-500/20 text-amber-600" : "bg-indigo-500/20 text-indigo-600"
              }`}>
                {turnoSeleccionado === "mañana" ? "☀ Turno de mañana" : "🌙 Turno de tarde"}
              </div>
              <div className="relative">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  value={cajaInicioPendiente}
                  onChange={(e) => setCajaInicioPendiente(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      iniciarTurno(turnoSeleccionado, parseFloat(cajaInicioPendiente) || 0);
                      setCajaInicioPendiente("");
                      setTurnoSeleccionado(null);
                    }
                  }}
                  placeholder="0.00"
                  className="w-full bg-white border border-gray-300 focus:border-amber-500 rounded-2xl px-4 py-4 text-2xl font-bold text-center outline-none tabular-nums"
                  style={{ fontSize: "28px" }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl font-bold">€</span>
              </div>
              <p className="text-center text-xs text-gray-500">Déjalo en 0 si no quieres registrarlo</p>
              <button
                onClick={() => {
                  iniciarTurno(turnoSeleccionado, parseFloat(cajaInicioPendiente) || 0);
                  setCajaInicioPendiente("");
                  setTurnoSeleccionado(null);
                }}
                className={`w-full py-5 rounded-2xl font-bold text-lg touch-manipulation ${
                  turnoSeleccionado === "mañana" ? "bg-amber-500 active:bg-amber-600 text-black" : "bg-indigo-600 active:bg-indigo-700 text-white"
                }`}
              >
                Empezar turno
              </button>
              <button
                onClick={() => { setTurnoSeleccionado(null); setCajaInicioPendiente(""); }}
                className="w-full py-3 rounded-2xl text-gray-500 text-sm touch-manipulation"
              >
                Volver
              </button>
            </div>
          ) : (
            /* Paso 1: elegir turno */
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => setTurnoSeleccionado("mañana")}
                className="w-full py-5 rounded-2xl bg-amber-500 active:bg-amber-600 text-black font-bold text-lg touch-manipulation flex items-center justify-center gap-3"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
                Turno de mañana
              </button>
              <button
                onClick={() => setTurnoSeleccionado("tarde")}
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
