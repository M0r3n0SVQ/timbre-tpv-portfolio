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
};

export type Cobro = {
  id: string;
  nombre_cuenta: string;
  items: Item[];
  total: number;
  created_at: string;
  sesion_id: string | null;
};

export type Sesion = {
  id: string;
  turno: "mañana" | "tarde";
  fecha: string;
  activa: boolean;
  caja_inicio: number;
  created_at: string;
};
