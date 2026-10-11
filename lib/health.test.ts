import { describe, expect, it } from "vitest";
import { comprobarSupabase } from "./health";

const URL_SB = "https://demo.supabase.co";

// fetch falso: responde según la ruta pedida.
function fetchFalso(respuestas: { auth: () => Response | Promise<Response>; db: () => Response | Promise<Response> }) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    return url.includes("/auth/v1/health") ? respuestas.auth() : respuestas.db();
  }) as typeof fetch;
}

const authOk = () => new Response("{}", { status: 200 });
const dbProtegida = () => Response.json({ code: "42501", message: "permission denied for table sesiones" }, { status: 401 });

describe("comprobarSupabase", () => {
  it("todo bien: auth responde y la base de datos rechaza a la clave pública", async () => {
    const salud = await comprobarSupabase(URL_SB, "k", fetchFalso({ auth: authOk, db: dbProtegida }));
    expect(salud.ok).toBe(true);
    expect(salud.comprobaciones.auth.ok).toBe(true);
    expect(salud.comprobaciones.baseDeDatos.ok).toBe(true);
  });

  it("falla si la clave pública puede leer datos (RLS roto)", async () => {
    const salud = await comprobarSupabase(URL_SB, "k", fetchFalso({ auth: authOk, db: () => Response.json([], { status: 200 }) }));
    expect(salud.ok).toBe(false);
    expect(salud.comprobaciones.baseDeDatos.detalle).toContain("RLS");
  });

  it("falla si el proyecto no responde (pausado o caído)", async () => {
    const salud = await comprobarSupabase(URL_SB, "k", fetchFalso({ auth: () => new Response("", { status: 503 }), db: () => new Response("", { status: 503 }) }));
    expect(salud.ok).toBe(false);
    expect(salud.comprobaciones.auth.detalle).toBe("HTTP 503");
  });

  it("falla si la base de datos devuelve un error que no es de permisos", async () => {
    const salud = await comprobarSupabase(URL_SB, "k", fetchFalso({ auth: authOk, db: () => Response.json({ code: "PGRST002" }, { status: 503 }) }));
    expect(salud.ok).toBe(false);
    expect(salud.comprobaciones.baseDeDatos.detalle).toContain("PGRST002");
  });

  it("falla por timeout sin quedarse colgado", async () => {
    const colgado = (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    const salud = await comprobarSupabase(URL_SB, "k", colgado as typeof fetch, 50);
    expect(salud.ok).toBe(false);
    expect(salud.comprobaciones.auth.detalle).toBe("sin respuesta en 50 ms");
  });
});
