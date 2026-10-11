// Lógica de /api/health, aparte para poder testearla sin red

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
    // Si el proyecto está caído o pausado no devuelve 200
    medir(fetchFn, `${supabaseUrl}/auth/v1/health`, { headers }, timeoutMs, async (res) =>
      res.ok ? null : `HTTP ${res.status}`,
    ),
    // Sin sesión tiene que dar permission denied (42501): así compruebo que la BD
    // responde y que RLS sigue bloqueando a la clave pública
    medir(fetchFn, `${supabaseUrl}/rest/v1/sesiones?select=id&limit=1`, { headers }, timeoutMs, async (res) => {
      if (res.ok) return "la clave pública puede leer datos: revisar RLS y permisos";
      const cuerpo = (await res.json().catch(() => null)) as { code?: string } | null;
      return cuerpo?.code === "42501" ? null : `HTTP ${res.status} ${cuerpo?.code ?? ""}`.trim();
    }),
  ]);

  return { ok: auth.ok && baseDeDatos.ok, comprobaciones: { auth, baseDeDatos } };
}
