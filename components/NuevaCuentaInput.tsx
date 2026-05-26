"use client";

import { useState } from "react";

type Props = { onCrear: (nombre: string) => void };

export default function NuevaCuentaInput({ onCrear }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");

  function confirmar() {
    if (!nombre.trim()) return;
    onCrear(nombre.trim());
    setNombre("");
    setAbierto(false);
  }

  if (!abierto)
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold text-sm transition-colors"
      >
        + Nueva cuenta
      </button>
    );

  return (
    <div className="flex gap-1.5">
      <input
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
          if (e.key === "Escape") { setAbierto(false); setNombre(""); }
        }}
        placeholder="Nombre de la cuenta…"
        className="flex-1 min-w-0 bg-gray-800 border border-gray-700 focus:border-amber-500 rounded-lg px-3 py-2 text-sm outline-none"
      />
      <button
        onClick={confirmar}
        className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-bold text-sm"
      >
        ✓
      </button>
      <button
        onClick={() => { setAbierto(false); setNombre(""); }}
        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
      >
        ✕
      </button>
    </div>
  );
}
