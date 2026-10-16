import type { Cobro, Item } from "./types";
import { claveItem } from "./itemIdentity";

// Margen para comparar importes: los totales son sumas de floats
// (1.1 * 3 = 3.3000000000000003), así que "igual" es "a menos de 0.001".
export const TOLERANCIA_CENTIMOS = 0.001;

export type LineaParcial = { nombre: string; precio: number; categoria?: string; max: number; cobrar: number };

export function totalLineas(items: Pick<Item, "precio" | "cantidad">[]): number {
  return items.reduce((s, i) => s + i.precio * i.cantidad, 0);
}

// Lo que queda por cobrar descontando lo ya pagado "a cuenta" por importe suelto.
export function pendientePorCobrar(total: number, cobradoParcial?: number): number {
  return Math.max(0, total - (cobradoParcial ?? 0));
}

// "" o texto no numérico cuenta como 0, igual que muestra el NumPad.
export function parsearImporte(texto: string): number {
  return parseFloat(texto) || 0;
}

export function calcularCambio(entregado: string, total: number): number {
  return parsearImporte(entregado) - total;
}

export function importePorPersona(total: number, personas: number): number {
  return total / personas;
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
  return lineas.reduce((s, l) => s + l.precio * l.cobrar, 0);
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
  return { total, efectivo, tarjeta };
}
