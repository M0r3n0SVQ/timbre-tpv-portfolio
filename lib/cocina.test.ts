import { describe, expect, it } from "vitest";
import { categoriaCocina, esItemCocina, pendienteDe, tieneCocinaPendiente, type ServidaLike } from "./cocina";
import type { Item } from "./types";

const lomoMontadito: Item = { nombre: "Lomo orza salmorejo", precio: 3.4, cantidad: 1, categoria: "Montaditos" };
const lomoTapa: Item = { nombre: "Lomo orza salmorejo", precio: 3.4, cantidad: 1, categoria: "Tapas" };

describe("categoriaCocina", () => {
  it("usa la categoria guardada en el item si la tiene", () => {
    expect(categoriaCocina(lomoTapa)).toBe("Tapas");
  });

  it("recurre a la carta si el item no trae categoria (datos antiguos)", () => {
    const sinCategoria: Item = { nombre: "Anchoas", precio: 3.4, cantidad: 1 };
    expect(categoriaCocina(sinCategoria)).toBe("Tapas");
  });

  it("no revienta con un nombre que no existe en la carta y sin categoria", () => {
    const libre: Item = { nombre: "Cosa rara", precio: 1, cantidad: 1 };
    expect(categoriaCocina(libre)).toBe("");
  });
});

describe("esItemCocina", () => {
  it("las bebidas no son de cocina", () => {
    expect(esItemCocina({ nombre: "Caña", precio: 1.6, cantidad: 1, categoria: "Bebidas" })).toBe(false);
  });

  it("un montadito sí es de cocina", () => {
    expect(esItemCocina(lomoMontadito)).toBe(true);
  });
});

describe("pendienteDe / tieneCocinaPendiente — el bug real", () => {
  it("servir el montadito NO marca como servida la tapa homónima (mismo nombre y precio)", () => {
    const cuentaId = "c1";
    // Solo se ha servido la unidad de Montaditos.
    const servidas: ServidaLike[] = [
      { cuenta_id: cuentaId, item_nombre: "Lomo orza salmorejo", precio: 3.4, categoria: "Montaditos", cantidad_servida: 1 },
    ];
    expect(pendienteDe(lomoMontadito, servidas, cuentaId)).toBe(0);
    // La tapa, con el mismo nombre y precio pero categoría distinta, sigue pendiente.
    expect(pendienteDe(lomoTapa, servidas, cuentaId)).toBe(1);
  });

  it("dos platos con el mismo nombre y precio en categorías distintas cuentan como dos pendientes", () => {
    const cuentaId = "c1";
    expect(tieneCocinaPendiente([lomoMontadito, lomoTapa], [], cuentaId)).toBe(true);
  });

  it("una cuenta sin nada de cocina no tiene pendientes", () => {
    const cuentaId = "c1";
    const cana: Item = { nombre: "Caña", precio: 1.6, cantidad: 2, categoria: "Bebidas" };
    expect(tieneCocinaPendiente([cana], [], cuentaId)).toBe(false);
  });

  it("las filas de servidas de OTRA cuenta no afectan al cálculo", () => {
    const servidas: ServidaLike[] = [
      { cuenta_id: "otra-cuenta", item_nombre: "Lomo orza salmorejo", precio: 3.4, categoria: "Montaditos", cantidad_servida: 1 },
    ];
    expect(pendienteDe(lomoMontadito, servidas, "c1")).toBe(1);
  });
});
