import type { Cobro, Item } from "./types";
import { claveItem } from "./itemIdentity";

// Margen para comparar importes que vienen de fuera (lo tecleado en el
// NumPad, lo que devuelve Supabase): "igual" es "a menos de 0.001".
export const TOLERANCIA_CENTIMOS = 0.001;

// Las sumas de floats dejan restos (1.1 * 3 = 3.3000000000000003). La base
// de datos guarda NUMERIC(8,2), así que en local redondeamos igual.
export function redondearCentimos(importe: number): number {
  return Math.round(importe * 100) / 100;
}

export type LineaParcial = { nombre: string; precio: number; categoria?: string; max: number; cobrar: number };

export function totalLineas(items: Pick<Item, "precio" | "cantidad">[]): number {
  return redondearCentimos(items.reduce((s, i) => s + i.precio * i.cantidad, 0));
}

// Lo que queda por cobrar descontando lo ya pagado "a cuenta" por importe suelto.
export function pendientePorCobrar(total: number, cobradoParcial?: number): number {
  return Math.max(0, redondearCentimos(total - (cobradoParcial ?? 0)));
}

// "" o texto no numérico cuenta como 0, igual que muestra el NumPad.
export function parsearImporte(texto: string): number {
  return parseFloat(texto) || 0;
}

export function calcularCambio(entregado: string, total: number): number {
  return redondearCentimos(parsearImporte(entregado) - total);
}

export type Reparto = { cadaUno: number; cuantosPaganMas: number; pagaMas: number };

// Reparte en céntimos para que la suma cuadre con el total: 10€ entre 3 son
// 3.33 cada uno y uno paga 3.34.
export function repartirEntre(total: number, personas: number): Reparto {
  if (!Number.isInteger(personas) || personas < 1) throw new RangeError(`No se puede repartir entre ${personas} personas`);
  const centimos = Math.round(total * 100);
  const base = Math.floor(centimos / personas);
  return { cadaUno: base / 100, cuantosPaganMas: centimos - base * personas, pagaMas: (base + 1) / 100 };
}

export function superaPendiente(importe: number, pendiente: number): boolean {
  return importe > pendiente + TOLERANCIA_CENTIMOS;
}

export function esImporteParcialValido(importe: number, pendiente: number): boolean {
  return importe > 0 && !superaPendiente(importe, pendiente);
}

// Si tras pagar este importe no queda nada (con margen), la cuenta se cierra.
export function cubrePendiente(pendiente: number, importe: number): boolean {
  return pendiente - importe <= TOLERANCIA_CENTIMOS;
}

export function totalSeleccion(lineas: LineaParcial[]): number {
  return redondearCentimos(lineas.reduce((s, l) => s + l.precio * l.cobrar, 0));
}

// Items que quedan en la cuenta tras cobrar la selección por artículos. Se
// casan por claveItem (nombre+precio+categoría) por los platos homónimos.
export function itemsRestantes(items: Item[], seleccion: LineaParcial[]): Item[] {
  return items
    .map((i) => {
      const l = seleccion.find((s) => claveItem(s.nombre, s.precio, s.categoria) === claveItem(i.nombre, i.precio, i.categoria));
      return l ? { ...i, cantidad: i.cantidad - l.cobrar } : i;
    })
    .filter((i) => i.cantidad > 0);
}

// Todo lo que no sea tarjeta cuenta como efectivo (cobros antiguos sin método).
// Number(): Supabase puede devolver los numeric como string.
export function desglosePorMetodo(cobros: Pick<Cobro, "total" | "metodo_pago">[]): { total: number; efectivo: number; tarjeta: number } {
  let total = 0;
  let efectivo = 0;
  let tarjeta = 0;
  for (const c of cobros) {
    total += Number(c.total);
    if (c.metodo_pago === "tarjeta") tarjeta += Number(c.total);
    else efectivo += Number(c.total);
  }
  return { total: redondearCentimos(total), efectivo: redondearCentimos(efectivo), tarjeta: redondearCentimos(tarjeta) };
}
