import { describe, expect, it } from "vitest";
import { claveItem } from "./itemIdentity";

describe("claveItem", () => {
  it("da la misma clave para nombre+precio+categoria idénticos", () => {
    expect(claveItem("Queso", 3.2, "Montaditos")).toBe(claveItem("Queso", 3.2, "Montaditos"));
  });

  it("distingue el mismo nombre y precio en categorías distintas (el bug real)", () => {
    // "Lomo orza salmorejo" vale 3.40€ tanto en Montaditos como en Tapas.
    const montadito = claveItem("Lomo orza salmorejo", 3.4, "Montaditos");
    const tapa = claveItem("Lomo orza salmorejo", 3.4, "Tapas");
    expect(montadito).not.toBe(tapa);
  });

  it("distingue el mismo nombre con precios distintos", () => {
    expect(claveItem("Queso", 3.2, "Montaditos")).not.toBe(claveItem("Queso", 3.0, "Tapas"));
  });

  it("distingue nombres distintos aunque coincidan precio y categoria", () => {
    expect(claveItem("Anchoas", 3.4, "Tapas")).not.toBe(claveItem("Mojama", 3.4, "Tapas"));
  });

  it("trata categoria undefined igual que cadena vacía", () => {
    expect(claveItem("Varios 5.00€", 5)).toBe(claveItem("Varios 5.00€", 5, ""));
  });

  it("no colisiona por concatenación ambigua entre nombre y precio", () => {
    // nombre="A1" precio=23 vs nombre="A" precio=123: si se concatenara sin
    // separador ambos darían "A123...", hace falta un separador real.
    expect(claveItem("A1", 23, "X")).not.toBe(claveItem("A", 123, "X"));
  });
});
