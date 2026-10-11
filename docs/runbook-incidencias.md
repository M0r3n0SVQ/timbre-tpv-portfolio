# Runbook de incidencias

Qué hacer cuando salta una alerta o algo falla durante el servicio. Cada entrada sigue el mismo orden: **síntoma → comprobar → actuar → confirmar**.

## Prioridades

| Nivel | Qué significa | Ejemplo | Respuesta |
|---|---|---|---|
| **P1** | El bar no puede cobrar o hay datos expuestos | `/api/health` en rojo, RLS roto | Inmediata, aunque sea en mitad del servicio |
| **P2** | La app funciona, pero se ha perdido una red de seguridad | Backup fallido, prueba de restauración fallida | El mismo día |
| **P3** | Mantenimiento | Alerta de Dependabot moderada | Esta semana |

**Mientras dura un P1 en servicio:** apuntar los pedidos y cobros en papel y pasarlos a la app cuando vuelva. La app no tiene modo sin conexión: lo que no llega a Supabase no queda guardado (sale un aviso rojo en pantalla).

---

## P1 · UptimeRobot: `/api/health` no responde 200

Abrir `https://<dominio>/api/health` en el navegador y mirar el JSON:

### a) No carga nada / error de Vercel

- **Comprobar:** <https://www.vercel-status.com> y Vercel → proyecto → *Deployments*: ¿el último despliegue está en *Ready*? ¿coincide con un push reciente?
- **Actuar:**
  - Si el problema empezó con un despliegue: *Deployments* → el anterior que funcionaba → **Instant Rollback**. Vuelve en segundos, sin rebuild.
  - Si Vercel está caído: esperar; no hay nada que hacer en nuestra parte.
- **Confirmar:** `/api/health` vuelve a 200. Después, revertir el commit culpable en `main` para que el siguiente push no lo vuelva a desplegar.

### b) `auth` falla (HTTP 5xx o sin respuesta)

Supabase está caído o el proyecto está **pausado** (el plan gratuito pausa los proyectos tras una semana sin actividad).

- **Comprobar:** <https://status.supabase.com> y el panel del proyecto: si aparece *Project paused*, es eso.
- **Actuar:** pausado → **Restore project** en el panel (unos minutos). Incidencia de Supabase → esperar y seguir en papel.
- **Confirmar:** `/api/health` en 200 y, en un móvil del bar, que se ven las cuentas abiertas.

### c) `baseDeDatos` dice "la clave pública puede leer datos" — incidente de seguridad

RLS o los permisos se han desactivado: cualquiera con la URL puede leer y modificar la base de datos.

- **Actuar ya:** SQL Editor → ejecutar [`2026-10-08-rls-autenticacion.sql`](../supabase/migrations/2026-10-08-rls-autenticacion.sql) (se puede ejecutar más de una vez).
- **Confirmar:** `/api/health` en 200 y la petición sin sesión del [runbook de RLS](./runbook-activar-rls.md#4-verificar) devuelve `permission denied`.
- **Después:** averiguar cómo pasó (¿se ejecutó el *rollback*? ¿un cambio a mano en el panel?) y revisar si hubo accesos raros en Supabase → *Logs* → *API Gateway* (solo guarda 24 h en el plan gratuito: mirarlo cuanto antes).

### d) `baseDeDatos` falla con otro código

PostgreSQL o la API de Supabase no responde, pero Auth sí.

- **Comprobar:** <https://status.supabase.com> y Supabase → *Logs* → *Postgres*.
- **Actuar:** igual que b). Si persiste más de 15 minutos sin incidencia oficial, abrir un ticket en el soporte de Supabase.

---

## P2 · Healthchecks.io: `timbre-backup` en rojo

### a) Llegó `/fail`: el backup se ejecutó y falló

GitHub → *Actions* → *Backup de la base de datos* → la ejecución fallida → paso en rojo:

| Error en el log | Causa probable | Solución |
|---|---|---|
| `password authentication failed` | Se cambió la contraseña de la base de datos | Actualizar el secret `SUPABASE_DB_URL` |
| `could not translate host name` / `timeout` | Proyecto pausado, o cambió el host del pooler | Ver P1 b); si cambió, copiar de nuevo la URI de *Connect → Session pooler* |
| `age: command not found` / fallo de `apt-get` | Cambio de la imagen `ubuntu-latest` del runner | Fijar `runs-on: ubuntu-24.04` o ajustar la instalación |
| `Falta AGE_RECIPIENT` | Variable borrada | Recrearla con la clave pública (`age1…`) |

Después: *Run workflow* a mano y comprobar que termina en verde.

### b) No llegó ningún ping: el backup ni se ejecutó

- **Comprobar:** GitHub → *Actions* → *Backup de la base de datos*. Si aparece *This scheduled workflow is disabled*, GitHub lo ha desactivado (lo hace en repositorios públicos tras 60 días sin actividad).
- **Actuar:** *Enable workflow* y *Run workflow* a mano. Si GitHub Actions está caído (<https://www.githubstatus.com>), esperar y lanzarlo cuando vuelva.

**Mientras no haya backup reciente:** Supabase → *Table Editor* → `cobros` → *Export to CSV* como copia manual.

## P2 · Healthchecks.io: `timbre-restore-test` en rojo

Es la alerta más importante de las P2: significa que **los backups podrían no servir** cuando hagan falta.

- **Comprobar:** el resumen de la ejecución en *Actions* (tabla de tablas y filas).
  - Filas distintas en una tabla con escrituras a esa hora → ver *Consistencia del manifiesto* en [backups.md](./backups.md#limitaciones-conocidas); relanzar.
  - RLS desactivado tras restaurar → el backup refleja el estado real de producción: tratarlo como P1 c).
  - Error de `age` al descifrar → el secret `AGE_SECRET_KEY` no corresponde con `AGE_RECIPIENT`; corregir desde el gestor de contraseñas.
  - Error de `pg_restore`/`psql` → cambio de esquema que el script no contempla: reproducir con `scripts/backup/restore.sh` y corregir.
- **Confirmar:** *Run workflow* a mano en verde.

---

## Pérdida o corrupción de datos

1. **¿Solo afecta al día actual?** (p. ej. se borró una cuenta por error) → Historial → **Restaurar**: recupera las cuentas y cobros del día desde la copia que guarda la propia app.
2. **¿Afecta a días anteriores o a toda la base de datos?** → seguir *Runbook: restaurar después de perder la base de datos* en [backups.md](./backups.md#runbook-restaurar-después-de-perder-la-base-de-datos). Se pierde como mucho lo ocurrido desde el último backup nocturno (RPO 24 h).

## Credenciales filtradas

| Qué se ha filtrado | Gravedad | Qué hacer |
|---|---|---|
| Contraseña del bar | Alta | Ver [runbook de RLS → Si se filtra la contraseña](./runbook-activar-rls.md#si-se-filtra-la-contraseña) |
| Contraseña de la base de datos (o `SUPABASE_DB_URL`) | Crítica: acceso total, sin RLS | Supabase → *Project Settings* → *Database* → *Reset database password* → actualizar el secret `SUPABASE_DB_URL` → lanzar el backup a mano para comprobarlo |
| Clave privada de age | Alta: permite leer los backups | `age-keygen` nuevo → actualizar `AGE_RECIPIENT` y `AGE_SECRET_KEY` → borrar los artifacts antiguos (*Actions* → ejecución → *Artifacts* → eliminar) |
| Clave pública de Supabase (*publishable*) | Ninguna | Es pública por diseño |
| URL de ping de Healthchecks | Baja: podrían ocultar un fallo | Healthchecks → check → *Regenerate ping URL* → actualizar el secret |

## Un dispositivo pide la contraseña

No es una incidencia: la sesión se ha perdido en ese móvil (datos del navegador borrados, móvil nuevo…). Escribir la contraseña del bar y seguir; no se pierde nada, porque los datos están en la base de datos. En iPhone, entrar **desde la app instalada**, no desde Safari.

## Alerta de seguridad de Dependabot

- **Crítica o alta en una dependencia de producción:** el CI ya bloquea los despliegues que la incluyan. Fusionar el PR de Dependabot (o `npm audit fix`) en cuanto el CI esté en verde.
- **En dependencias de desarrollo:** P3, revisar en la siguiente sesión de mantenimiento.

---

## Después de cada P1 o P2

Una nota breve en el propio repositorio (issue o `docs/incidentes/AAAA-MM-DD.md`):

- **Qué pasó** y **cuándo** (detección, mitigación, resolución).
- **Impacto:** cuánto tiempo, qué se perdió.
- **Causa raíz.**
- **Qué cambia** para que no se repita (un test, una alerta, un paso en este runbook).

Ejemplo real: el [incidente de platos homónimos](../ARCHITECTURE.md#incidente-platos-homónimos-entre-categorías) terminó con tests y CI. El primer backup automático destapó que la copia del día de la app no se guardaba en Supabase, y terminó con un arreglo en la app.
