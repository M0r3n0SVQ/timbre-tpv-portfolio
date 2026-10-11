"use client";

import { useState } from "react";

type Props = { iniciarSesion: (password: string) => Promise<string | null> };

// Solo sale la primera vez en cada móvil. No hay botón de cerrar sesión a propósito.
export default function PantallaLogin({ iniciarSesion }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar() {
    if (!password || entrando) return;
    setEntrando(true);
    setError(null);
    const fallo = await iniciarSesion(password);
    if (fallo) {
      setError(fallo);
      setPassword("");
    }
    setEntrando(false);
  }

  return (
    <div className="bg-gray-50 text-gray-900 flex flex-col items-center justify-center px-8 gap-8"
         style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex flex-col items-center gap-2">
        <img src="/logo.jpg" alt="Cervecería El Timbre" className="w-36 h-36 rounded-3xl object-contain bg-white p-2 shadow-xl" />
        <p className="text-gray-500 text-sm mt-1">Introduce la contraseña del bar</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); entrar(); }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <input
          autoFocus
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="w-full bg-white border border-gray-300 focus:border-amber-500 rounded-2xl px-4 py-4 text-center outline-none"
          style={{ fontSize: "20px" }}
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={!password || entrando}
          className="w-full py-5 rounded-2xl bg-amber-500 active:bg-amber-600 disabled:opacity-50 text-black font-bold text-lg touch-manipulation"
        >
          {entrando ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-center text-xs text-gray-500">Solo hace falta la primera vez en cada móvil</p>
      </form>
    </div>
  );
}
