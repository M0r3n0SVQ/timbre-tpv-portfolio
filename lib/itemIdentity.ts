// Identidad de un plato dentro de una cuenta. nombre+precio NO basta: varios
// platos comparten nombre Y precio entre categorías (p.ej. "Lomo orza
// salmorejo" vale 3.40€ tanto en Montaditos como en Tapas), así que hace
// falta también la categoría para no confundir un montadito con una tapa.
export function claveItem(nombre: string, precio: number, categoria?: string): string {
  return nombre + "|" + precio + "|" + (categoria ?? "");
}
