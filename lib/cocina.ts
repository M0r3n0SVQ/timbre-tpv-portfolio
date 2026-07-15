import type { Item } from "./types";
import { PRODUCTOS } from "./carta";
import { claveItem } from "./itemIdentity";

export const CATS_COCINA = ["Montaditos", "Tapas"];

export type ServidaLike = {
  cuenta_id: string;
  item_nombre: string;
  precio: number;
  categoria: string;
  cantidad_servida: number;
};

// Categoría "efectiva" de un item para cocina: la que tiene guardada la
// propia línea del ticket, o si no la tuviera (datos antiguos / catálogo),
// la de la carta. Tiene que ser la MISMA fórmula que se usa al escribir en
// comandas_servidas (servirUno/servirTodo) — si no, buscarServida no
// encuentra la fila aunque exista.
export function categoriaCocina(item: Item): string {
  return (item.categoria || PRODUCTOS.find((p) => p.nombre === item.nombre)?.categoria) ?? "";
}

export function esItemCocina(item: Item): boolean {
  return CATS_COCINA.includes(categoriaCocina(item));
}

export function buscarServida(servidas: ServidaLike[], cuentaId: string, item: Item): ServidaLike | undefined {
  const clave = claveItem(item.nombre, item.precio, categoriaCocina(item));
  return servidas.find((s) => s.cuenta_id === cuentaId && claveItem(s.item_nombre, s.precio, s.categoria) === clave);
}

export function pendienteDe(item: Item, servidas: ServidaLike[], cuentaId: string): number {
  const servida = buscarServida(servidas, cuentaId, item);
  return item.cantidad - (servida?.cantidad_servida ?? 0);
}

export function tieneCocinaPendiente(items: Item[], servidas: ServidaLike[], cuentaId: string): boolean {
  return items.some((item) => esItemCocina(item) && pendienteDe(item, servidas, cuentaId) > 0);
}
