"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// undefined mientras carga. Devuelvo un boolean y no la Session porque esta
// cambia en cada renovación del token y haría re-renderizar todo el TPV.
export function useAuth() {
  const [autenticado, setAutenticado] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAutenticado(!!data.session));

    // Si falla la red al renovar, supabase-js reintenta y no cierra la sesión
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
