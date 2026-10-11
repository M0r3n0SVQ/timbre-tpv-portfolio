// Comprobaciones del health check (/api/health), separadas de la ruta para
// poder testearlas sin red.

export type Comprobacion = { ok: boolean; ms: number; detalle: string };
export type Salud = { ok: boolean; comprobaciones: Record<string, Comprobacion> };

type Fetch = typeof fetch;

async function medir(
  fetchFn: Fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  evaluar: (res: Response) => Promise<string | null>,
): Promise<Comprobacion> {
  const inicio = Date.now();
  try {
    const res = await fetchFn(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    const fallo = await evaluar(res);
    return { ok: fallo === null, ms: Date.now() - inicio, detalle: fallo ?? `HTTP ${res.status}` };
  } catch (e) {
    const detalle = e instanceof Error && e.name === "TimeoutError" ? `sin respuesta en ${timeoutMs} ms` : "error de red";
    return { ok: false, ms: Date.now() - inicio, detalle };
  }
}

export async function comprobarSupabase(
  supabaseUrl: string,
  clavePublica: string,
  fetchFn: Fetch = fetch,
  timeoutMs = 5000,
): Promise<Salud> {
  const headers = { apikey: clavePublica };

  const [auth, baseDeDatos] = await Promise.all([
    // El proyecto está levantado (un proyecto pausado o caído no responde 200).
    medir(fetchFn, `${supabaseUrl}/auth/v1/health`, { headers }, timeoutMs, async (res) =>
      res.ok ? null : `HTTP ${res.status}`,
    ),
    // Sin sesión, PostgreSQL debe rechazar la lectura por permisos (42501).
    // Ese rechazo prueba que la base de datos responde y, a la vez, que la
    // clave pública sigue sin acceso: si un día devolviera datos, RLS o los
    // permisos se habrían roto y el health check falla.
    medir(fetchFn, `${supabaseUrl}/rest/v1/sesiones?select=id&limit=1`, { headers }, timeoutMs, async (res) => {
      if (res.ok) return "la clave pública puede leer datos: revisar RLS y permisos";
      const cuerpo = (await res.json().catch(() => null)) as { code?: string } | null;
      return cuerpo?.code === "42501" ? null : `HTTP ${res.status} ${cuerpo?.code ?? ""}`.trim();
    }),
  ]);

  return { ok: auth.ok && baseDeDatos.ok, comprobaciones: { auth, baseDeDatos } };
}
