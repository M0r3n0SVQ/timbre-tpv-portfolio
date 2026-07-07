export type Producto = { id: string; nombre: string; precio: number; categoria: string };

export const PRODUCTOS: Producto[] = [
  // BEBIDAS
  { id: 'p01', nombre: 'Caña',              precio: 1.60, categoria: 'Bebidas' },
  { id: 'p02', nombre: 'Cortada',           precio: 1.70, categoria: 'Bebidas' },
  { id: 'p03', nombre: 'Sin gluten',        precio: 1.80, categoria: 'Bebidas' },
  { id: 'p04', nombre: 'Radler',            precio: 2.00, categoria: 'Bebidas' },
  { id: 'p05', nombre: 'Sin alcohol 20cl',  precio: 1.50, categoria: 'Bebidas' },
  { id: 'p06', nombre: 'Sin alcohol 33cl',  precio: 2.00, categoria: 'Bebidas' },
  { id: 'p15', nombre: 'Refresco',          precio: 1.80, categoria: 'Bebidas' },
  { id: 'p16', nombre: 'Agua',              precio: 0.80, categoria: 'Bebidas' },
  { id: 'p59', nombre: 'Zumo de piña',      precio: 1.20, categoria: 'Bebidas' },

  // VINOS
  { id: 'p07', nombre: 'Tinto verano',      precio: 1.80, categoria: 'Vinos' },
  { id: 'p08', nombre: 'Rioja',             precio: 3.00, categoria: 'Vinos' },
  { id: 'p09', nombre: 'Ribera',            precio: 2.50, categoria: 'Vinos' },
  { id: 'p10', nombre: 'Verdejo',           precio: 2.50, categoria: 'Vinos' },
  { id: 'p11', nombre: 'Manzanilla',        precio: 1.40, categoria: 'Vinos' },
  { id: 'p12', nombre: 'Vermú',             precio: 1.50, categoria: 'Vinos' },
  { id: 'p13', nombre: 'Cream',             precio: 1.50, categoria: 'Vinos' },
  { id: 'p14', nombre: 'V. naranja',        precio: 1.50, categoria: 'Vinos' },

  // MONTADITOS
  { id: 'p17', nombre: 'Melva morrón',          precio: 3.40, categoria: 'Montaditos' },
  { id: 'p18', nombre: 'Bacalao salmorejo',      precio: 3.40, categoria: 'Montaditos' },
  { id: 'p19', nombre: 'Salmón guacamole',       precio: 3.40, categoria: 'Montaditos' },
  { id: 'p20', nombre: 'Chorizo picante',        precio: 3.00, categoria: 'Montaditos' },
  { id: 'p21', nombre: 'Ch. picante roque',      precio: 3.40, categoria: 'Montaditos' },
  { id: 'p22', nombre: 'Mechá Q/M',             precio: 3.40, categoria: 'Montaditos' },
  { id: 'p23', nombre: 'Chicharrón Q/M',        precio: 3.40, categoria: 'Montaditos' },
  { id: 'p24', nombre: 'Tortilla whisky',        precio: 3.20, categoria: 'Montaditos' },
  { id: 'p25', nombre: 'Lomo orza salmorejo',    precio: 3.40, categoria: 'Montaditos' },
  { id: 'p26', nombre: 'Lomo orza rulo cabra',   precio: 3.40, categoria: 'Montaditos' },
  { id: 'p27', nombre: 'Lomo al whisky',         precio: 3.40, categoria: 'Montaditos' },
  { id: 'p28', nombre: 'Piripi',                 precio: 3.40, categoria: 'Montaditos' },
  { id: 'p29', nombre: 'Serranito',              precio: 3.40, categoria: 'Montaditos' },
  { id: 'p30', nombre: 'Caña de lomo',           precio: 3.20, categoria: 'Montaditos' },
  { id: 'p31', nombre: 'Salchichón',             precio: 3.20, categoria: 'Montaditos' },
  { id: 'p32', nombre: 'Queso',                  precio: 3.20, categoria: 'Montaditos' },

  // APERITIVOS
  { id: 'p33', nombre: 'Patatas hispalanas',     precio: 1.30, categoria: 'Aperitivos' },
  { id: 'p34', nombre: 'Fogón real',             precio: 1.10, categoria: 'Aperitivos' },
  { id: 'p35', nombre: 'Torreznos',              precio: 1.50, categoria: 'Aperitivos' },
  
  // TAPAS
  { id: 'p36', nombre: 'Anchoas',                precio: 3.40, categoria: 'Tapas' },
  { id: 'p37', nombre: 'Mojama',                 precio: 3.60, categoria: 'Tapas' },
  { id: 'p38', nombre: 'Melva',                  precio: 3.40, categoria: 'Tapas' },
  { id: 'p39', nombre: 'Hueva de maruca',        precio: 3.40, categoria: 'Tapas' },
  { id: 'p40', nombre: 'Agujas',                 precio: 3.20, categoria: 'Tapas' },
  { id: 'p41', nombre: 'Mejillones escabeche',   precio: 3.50, categoria: 'Tapas' },
  { id: 'p42', nombre: 'Caña de lomo',           precio: 3.50, categoria: 'Tapas' },
  { id: 'p43', nombre: 'Queso',                  precio: 3.00, categoria: 'Tapas' },
  { id: 'p44', nombre: 'Queso en aceite',        precio: 3.00, categoria: 'Tapas' },
  { id: 'p45', nombre: 'Salchichón ibérico',     precio: 3.00, categoria: 'Tapas' },
  { id: 'p46', nombre: 'Mechá',                  precio: 3.00, categoria: 'Tapas' },
  { id: 'p47', nombre: 'Chicharrón de Cádiz',    precio: 3.00, categoria: 'Tapas' },
  { id: 'p48', nombre: 'Morcilla hígado',        precio: 1.50, categoria: 'Tapas' },
  { id: 'p49', nombre: 'Provolone',              precio: 5.00, categoria: 'Tapas' },
  { id: 'p50', nombre: 'Caracoles',              precio: 2.50, categoria: 'Tapas' },
  { id: 'p51', nombre: 'Bacalao salmorejo',      precio: 3.40, categoria: 'Tapas' },
  { id: 'p52', nombre: 'Salmón guacamole',       precio: 3.40, categoria: 'Tapas' },
  { id: 'p53', nombre: 'Chorizo picante',        precio: 3.00, categoria: 'Tapas' },
  { id: 'p54', nombre: 'Tortilla whisky',        precio: 3.00, categoria: 'Tapas' },
  { id: 'p55', nombre: 'Gildas boquerón 3u',     precio: 3.00, categoria: 'Tapas' },
  { id: 'p56', nombre: 'Gildas anchoas 3u',      precio: 3.00, categoria: 'Tapas' },
  { id: 'p57', nombre: 'Lomo orza salmorejo',    precio: 3.40, categoria: 'Tapas' },
  { id: 'p58', nombre: 'Lomo orza rulo cabra',   precio: 3.40, categoria: 'Tapas' },
];

export const CATEGORIAS = Array.from(new Set(PRODUCTOS.map((p) => p.categoria)));
