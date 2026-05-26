"use client";

type Props = { nombre: string; precio: number; onClick: () => void };

export default function BotonProducto({ nombre, precio, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center px-3 py-2.5 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl text-sm font-medium transition-colors min-w-[80px]"
    >
      <span>{nombre}</span>
      <span className="text-amber-400 text-xs mt-0.5">{precio.toFixed(2)}€</span>
    </button>
  );
}
