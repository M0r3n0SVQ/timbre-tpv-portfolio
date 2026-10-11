import { comprobarSupabase } from "@/lib/health";

// Health check para el monitor de disponibilidad (UptimeRobot). Responde 200
// si Supabase está levantado y la base de datos sigue protegida, 503 si no.
// Se ejecuta en cada petición: un resultado cacheado no serviría de nada.
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) {
    return Response.json({ ok: false, error: "faltan variables de entorno de Supabase" }, { status: 503 });
  }

  const salud = await comprobarSupabase(url, clave);
  return Response.json(
    { ...salud, comprobadoEn: new Date().toISOString() },
    { status: salud.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
