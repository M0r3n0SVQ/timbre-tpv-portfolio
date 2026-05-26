"use client";

import type { Item } from "@/lib/types";

type Props = {
  items: Item[];
  onSumar: (nombre: string) => void;
  onRestar: (nombre: string) => void;
};

export default function ListaItems({ items, onSumar, onRestar }: Props) {
  if (items.length === 0)
    return <p className="text-gray-600 text-sm">Sin artículos todavía.</p>;

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => (
        <div
          key={item.nombre}
          className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-2.5"
        >
          <span className="font-medium">{item.nombre}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onRestar(item.nombre)}
              className="w-7 h-7 rounded-full bg-gray-700 hover:bg-red-700 font-bold leading-none transition-colors"
            >
              −
            </button>
            <span className="w-5 text-center tabular-nums">{item.cantidad}</span>
            <button
              onClick={() => onSumar(item.nombre)}
              className="w-7 h-7 rounded-full bg-gray-700 hover:bg-green-700 font-bold leading-none transition-colors"
            >
              +
            </button>
            <span className="w-16 text-right text-amber-400 tabular-nums">
              {(item.precio * item.cantidad).toFixed(2)}€
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
