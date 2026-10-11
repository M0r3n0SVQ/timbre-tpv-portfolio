import { comprobarSupabase } from "@/lib/health";

// Lo consulta UptimeRobot. 200 si todo va bien, 503 si algo falla. Sin caché.
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
