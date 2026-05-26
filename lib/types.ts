export type Item = {
  nombre: string;
  precio: number;
  cantidad: number;
};

export type Cuenta = {
  id: string;
  nombre: string;
  items: Item[];
  total: number;
  created_at: string;
};

export type Cobro = {
  id: string;
  nombre_cuenta: string;
  items: Item[];
  total: number;
  created_at: string;
  sesion_id: string | null;
};
