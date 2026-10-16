import { describe, expect, it } from "vitest";
import {
  calcularCambio,
  cubrePendiente,
  desglosePorMetodo,
  esImporteParcialValido,
  importePorPersona,
  itemsRestantes,
  parsearImporte,
  pendientePorCobrar,
  superaPendiente,
  totalLineas,
  totalSeleccion,
  type LineaParcial,
} from "./cobro";
import type { Item, MetodoPago } from "./types";

const lomoMontadito: Item = { nombre: "Lomo orza salmorejo", precio: 3.4, cantidad: 2, categoria: "Montaditos" };
const lomoTapa: Item = { nombre: "Lomo orza salmorejo", precio: 3.4, cantidad: 1, categoria: "Tapas" };
const cana: Item = { nombre: "Caña", precio: 1.5, cantidad: 3, categoria: "Bebidas" };

function linea(item: Item, cobrar: number): LineaParcial {
  return { nombre: item.nombre, precio: item.precio, categoria: item.categoria, max: item.cantidad, cobrar };
}

describe("totalLineas", () => {
  it("suma precio por cantidad", () => {
    expect(totalLineas([lomoMontadito, cana])).toBeCloseTo(11.3, 10);
  });

  it("cuenta vacía da 0", () => {
    expect(totalLineas([])).toBe(0);
  });

  it("no redondea a céntimos: arrastra el error de los floats", () => {
    expect(totalLineas([{ precio: 0.1, cantidad: 3 }])).toBe(0.30000000000000004);
    expect(totalLineas([{ precio: 0.1, cantidad: 3 }]).toFixed(2)).toBe("0.30");
  });
});

describe("pendientePorCobrar", () => {
  it("sin pagos a cuenta es el total", () => {
    expect(pendientePorCobrar(20)).toBe(20);
  });

  it("descuenta lo ya cobrado a cuenta", () => {
    expect(pendientePorCobrar(40, 15.5)).toBe(24.5);
  });

  it("nunca baja de 0 aunque se haya cobrado de más", () => {
    expect(pendientePorCobrar(10, 12)).toBe(0);
  });

  it("deja un resto minúsculo si el total viene de floats", () => {
    const total = totalLineas([{ precio: 1.1, cantidad: 3 }]);
    const pendiente = pendientePorCobrar(total, 3.3);
    expect(pendiente).toBeGreaterThan(0);
    expect(cubrePendiente(pendiente, 0)).toBe(true);
  });
});

describe("parsearImporte", () => {
  it("lee el texto del NumPad", () => {
    expect(parsearImporte("12.5")).toBe(12.5);
    expect(parsearImporte("0.05")).toBe(0.05);
  });

  it("vacío o solo un punto cuenta como 0", () => {
    expect(parsearImporte("")).toBe(0);
    expect(parsearImporte(".")).toBe(0);
  });
});

describe("calcularCambio", () => {
  it("devuelve lo que hay que dar de vuelta", () => {
    expect(calcularCambio("50", 37.8)).toBeCloseTo(12.2, 10);
  });

  it("exacto da 0", () => {
    expect(calcularCambio("12.40", 12.4)).toBe(0);
  });

  it("si entregan menos que el total sale negativo (lo que falta)", () => {
    expect(calcularCambio("10", 12.4)).toBeCloseTo(-2.4, 10);
  });

  it("sin nada tecleado es menos el total", () => {
    expect(calcularCambio("", 8)).toBe(-8);
  });

  it("céntimos", () => {
    expect(calcularCambio("20.05", 19.95).toFixed(2)).toBe("0.10");
  });
});

describe("importePorPersona", () => {
  it("división exacta", () => {
    expect(importePorPersona(30, 2)).toBe(15);
  });

  it("si no da exacto, se muestra redondeado y no cuadra al céntimo", () => {
    const porPersona = importePorPersona(10, 3);
    expect(porPersona.toFixed(2)).toBe("3.33");
    expect((Number(porPersona.toFixed(2)) * 3).toFixed(2)).toBe("9.99");
  });

  it("cuenta a 0", () => {
    expect(importePorPersona(0, 4)).toBe(0);
  });
});

describe("cobro parcial por importe", () => {
  it("acepta un importe menor que lo pendiente sin cerrar la cuenta", () => {
    expect(esImporteParcialValido(20, 50)).toBe(true);
    expect(cubrePendiente(50, 20)).toBe(false);
  });

  it("el importe justo cierra la cuenta", () => {
    expect(esImporteParcialValido(50, 50)).toBe(true);
    expect(cubrePendiente(50, 50)).toBe(true);
  });

  it("cierra aunque el pendiente arrastre error de floats", () => {
    const pendiente = totalLineas([{ precio: 0.1, cantidad: 3 }]);
    expect(esImporteParcialValido(0.3, pendiente)).toBe(true);
    expect(cubrePendiente(pendiente, 0.3)).toBe(true);
  });

  it("no deja cobrar más de lo pendiente", () => {
    expect(superaPendiente(50.01, 50)).toBe(true);
    expect(esImporteParcialValido(50.01, 50)).toBe(false);
  });

  it("rechaza 0, negativos y texto vacío", () => {
    expect(esImporteParcialValido(0, 50)).toBe(false);
    expect(esImporteParcialValido(-5, 50)).toBe(false);
    expect(esImporteParcialValido(parsearImporte(""), 50)).toBe(false);
  });

  it("con la cuenta ya saldada no se puede cobrar nada más", () => {
    expect(esImporteParcialValido(0.01, 0)).toBe(false);
  });
});

describe("cobro parcial por artículos", () => {
  it("totalSeleccion suma solo lo marcado", () => {
    expect(totalSeleccion([linea(lomoMontadito, 1), linea(cana, 2), linea(lomoTapa, 0)])).toBeCloseTo(6.4, 10);
  });

  it("totalSeleccion sin nada marcado da 0", () => {
    expect(totalSeleccion([linea(cana, 0)])).toBe(0);
    expect(totalSeleccion([])).toBe(0);
  });

  it("itemsRestantes resta lo cobrado y quita las líneas a 0", () => {
    const restantes = itemsRestantes([lomoMontadito, cana], [linea(lomoMontadito, 1), linea(cana, 3)]);
    expect(restantes).toEqual([{ ...lomoMontadito, cantidad: 1 }]);
  });

  it("itemsRestantes no confunde el montadito con la tapa homónima", () => {
    const restantes = itemsRestantes([lomoMontadito, lomoTapa], [linea(lomoMontadito, 0), linea(lomoTapa, 1)]);
    expect(restantes).toEqual([lomoMontadito]);
  });

  it("itemsRestantes cobrándolo todo deja la cuenta vacía", () => {
    expect(itemsRestantes([cana], [linea(cana, 3)])).toEqual([]);
  });

  it("itemsRestantes con cuenta vacía", () => {
    expect(itemsRestantes([], [])).toEqual([]);
  });
});

describe("desglosePorMetodo", () => {
  it("separa efectivo y tarjeta", () => {
    const d = desglosePorMetodo([
      { total: 12.5, metodo_pago: "efectivo" },
      { total: 20, metodo_pago: "tarjeta" },
      { total: 3.4, metodo_pago: "efectivo" },
    ]);
    expect(d.efectivo).toBeCloseTo(15.9, 10);
    expect(d.tarjeta).toBe(20);
    expect(d.total).toBeCloseTo(35.9, 10);
  });

  it("cobros antiguos sin método cuentan como efectivo", () => {
    const sinMetodo = { total: 5, metodo_pago: null as unknown as MetodoPago };
    expect(desglosePorMetodo([sinMetodo])).toEqual({ total: 5, efectivo: 5, tarjeta: 0 });
  });

  it("acepta totales que llegan como string desde Supabase", () => {
    const comoString = { total: "7.20" as unknown as number, metodo_pago: "tarjeta" as const };
    expect(desglosePorMetodo([comoString])).toEqual({ total: 7.2, efectivo: 0, tarjeta: 7.2 });
  });

  it("sin cobros todo a 0", () => {
    expect(desglosePorMetodo([])).toEqual({ total: 0, efectivo: 0, tarjeta: 0 });
  });
});
