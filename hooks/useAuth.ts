"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// undefined = todavía comprobando, false = sin sesión, true = con sesión.
//
// Solo se expone SI hay sesión, no el objeto Session: Supabase emite uno nuevo
// cada vez que renueva el token (cada hora), y si la UI dependiera de él se
// volvería a montar entera en mitad del turno.
export function useAuth() {
  const [autenticado, setAutenticado] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAutenticado(!!data.session));

    // Un corte de red al renovar el token NO dispara SIGNED_OUT (supabase-js
    // reintenta y conserva la sesión); solo se pierde si Supabase la rechaza
    // de verdad, p. ej. porque se ha borrado la cuenta.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, session) => {
      setAutenticado(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function iniciarSesion(password: string): Promise<string | null> {
    const email = process.env.NEXT_PUBLIC_TPV_EMAIL;
    if (!email) return "Falta configurar NEXT_PUBLIC_TPV_EMAIL";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return null;
    if (error.status === 400) return "Contraseña incorrecta";
    return "Sin conexión. Inténtalo de nuevo";
  }

  return { autenticado, iniciarSesion };
}
