export type Item = {
  nombre: string;
  precio: number;
  cantidad: number;
  categoria?: string;
  added_at?: string;
};

export type Cuenta = {
  id: string;
  nombre: string;
  items: Item[];
  total: number;
  created_at: string;
  pagada?: boolean;
  // Dinero ya cobrado "a cuenta" por un importe suelto (no ligado a
  // artículos concretos, p.ej. "aquí tienes 50€, el resto luego"). Lo que
  // queda por cobrar es total - cobrado_parcial.
  cobrado_parcial?: number;
};

export type MetodoPago = "efectivo" | "tarjeta";

export type Cobro = {
  id: string;
  nombre_cuenta: string;
  items: Item[];
  total: number;
  created_at: string;
  sesion_id: string | null;
  metodo_pago: MetodoPago;
};

export type Sesion = {
  id: string;
  turno: "mañana" | "tarde";
  fecha: string;
  activa: boolean;
  caja_inicio: number;
  created_at: string;
};
