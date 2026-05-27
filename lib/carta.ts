export type Producto = { id: string; nombre: string; precio: number; categoria: string };

export const PRODUCTOS: Producto[] = [
  // CERVEZAS
  { id: 'p01', nombre: 'Caña',              precio: 1.60, categoria: 'Cervezas' },
  { id: 'p02', nombre: 'Cortada',           precio: 1.70, categoria: 'Cervezas' },
  { id: 'p03', nombre: 'Sin gluten',        precio: 1.80, categoria: 'Cervezas' },
  { id: 'p04', nombre: 'Radler',            precio: 2.00, categoria: 'Cervezas' },
  { id: 'p05', nombre: 'Sin alcohol 20cl',  precio: 1.50, categoria: 'Cervezas' },
  { id: 'p06', nombre: 'Sin alcohol 33cl',  precio: 2.00, categoria: 'Cervezas' },
  // VINOS
  { id: 'p07', nombre: 'Tinto verano',      precio: 1.80, categoria: 'Vinos' },
  { id: 'p08', nombre: 'Rioja',             precio: 3.00, categoria: 'Vinos' },
  { id: 'p09', nombre: 'Ribera',            precio: 2.50, categoria: 'Vinos' },
  { id: 'p10', nombre: 'Verdejo',           precio: 2.50, categoria: 'Vinos' },
  { id: 'p11', nombre: 'Manzanilla',        precio: 1.40, categoria: 'Vinos' },
  { id: 'p12', nombre: 'Vermú',             precio: 1.50, categoria: 'Vinos' },
  { id: 'p13', nombre: 'Cream',             precio: 1.50, categoria: 'Vinos' },
  { id: 'p14', nombre: 'V. naranja',        precio: 1.50, categoria: 'Vinos' },
  // REFRESCOS
  { id: 'p15', nombre: 'Refresco',          precio: 1.80, categoria: 'Refrescos' },
  // MONTADITOS
  { id: 'p16', nombre: 'Melva morrón',          precio: 3.40, categoria: 'Montaditos' },
  { id: 'p17', nombre: 'Bacalao salmorejo',      precio: 3.40, categoria: 'Montaditos' },
  { id: 'p18', nombre: 'Salmón guacamole',       precio: 3.40, categoria: 'Montaditos' },
  { id: 'p19', nombre: 'Chorizo picante',        precio: 3.00, categoria: 'Montaditos' },
  { id: 'p20', nombre: 'Ch. picante roque',      precio: 3.40, categoria: 'Montaditos' },
  { id: 'p21', nombre: 'Mechá queso mojo',       precio: 3.40, categoria: 'Montaditos' },
  { id: 'p22', nombre: 'Chicharrón q. mojo',     precio: 3.40, categoria: 'Montaditos' },
  { id: 'p23', nombre: 'Tortilla whisky',        precio: 3.00, categoria: 'Montaditos' },
  { id: 'p24', nombre: 'Lomo orza salmorejo',    precio: 3.40, categoria: 'Montaditos' },
  { id: 'p25', nombre: 'Lomo orza rulo cabra',   precio: 3.40, categoria: 'Montaditos' },
  { id: 'p26', nombre: 'Lomo al whisky',         precio: 3.40, categoria: 'Montaditos' },
  { id: 'p27', nombre: 'Piripi',                 precio: 3.40, categoria: 'Montaditos' },
  { id: 'p28', nombre: 'Serranito',              precio: 3.40, categoria: 'Montaditos' },
  { id: 'p29', nombre: 'Caña salchichón queso',  precio: 3.20, categoria: 'Montaditos' },
  // PATATAS
  { id: 'p43', nombre: 'Patatas hispalanas', precio: 1.30, categoria: 'Patatas' },
  { id: 'p44', nombre: 'Fogón real',         precio: 1.10, categoria: 'Patatas' },
  // TAPAS
  { id: 'p30', nombre: 'Anchoas',                precio: 3.40, categoria: 'Tapas' },
  { id: 'p31', nombre: 'Mojama',                 precio: 3.60, categoria: 'Tapas' },
  { id: 'p32', nombre: 'Melva',                  precio: 3.40, categoria: 'Tapas' },
  { id: 'p33', nombre: 'Hueva de maruca',        precio: 3.40, categoria: 'Tapas' },
  { id: 'p34', nombre: 'Agujas en aceite',       precio: 3.20, categoria: 'Tapas' },
  { id: 'p35', nombre: 'Mejillones escabeche',   precio: 3.50, categoria: 'Tapas' },
  { id: 'p36', nombre: 'Caña de lomo',           precio: 3.50, categoria: 'Tapas' },
  { id: 'p37', nombre: 'Queso',                  precio: 3.00, categoria: 'Tapas' },
  { id: 'p38', nombre: 'Salchichón ibérico',     precio: 3.00, categoria: 'Tapas' },
  { id: 'p39', nombre: 'Mechá',                  precio: 3.00, categoria: 'Tapas' },
  { id: 'p40', nombre: 'Chicharrón de Cádiz',    precio: 3.00, categoria: 'Tapas' },
  { id: 'p41', nombre: 'Morcilla hígado',        precio: 1.50, categoria: 'Tapas' },
  { id: 'p42', nombre: 'Provolone',              precio: 4.50, categoria: 'Tapas' },
  { id: 'p45', nombre: 'Caracoles',              precio: 2.50, categoria: 'Tapas' },
  { id: 'p46', nombre: 'Bacalao salmorejo',      precio: 3.40, categoria: 'Tapas' },
  { id: 'p47', nombre: 'Salmón guacamole',       precio: 3.40, categoria: 'Tapas' },
  { id: 'p48', nombre: 'Chorizo picante',        precio: 3.00, categoria: 'Tapas' },
  { id: 'p49', nombre: 'Tortilla whisky',        precio: 3.00, categoria: 'Tapas' },
];

export const CATEGORIAS = Array.from(new Set(PRODUCTOS.map((p) => p.categoria)));
