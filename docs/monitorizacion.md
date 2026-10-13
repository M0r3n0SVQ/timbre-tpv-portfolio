# Monitorización y alertas

| Qué se vigila | Cómo | Cada cuánto | Alerta si |
|---|---|---|---|
| La web carga y Supabase responde | UptimeRobot → `GET /api/health` | 5 min | La URL no responde o devuelve un código distinto de 200 |
| El backup nocturno se ejecuta y termina bien | Healthchecks.io (*dead man's switch*) | Diario | No llega el ping en 25 h, o llega como `/fail` |
| La prueba de restauración se ejecuta y termina bien | Healthchecks.io | Semanal | No llega el ping en 7 días + 12 h, o llega como `/fail` |

Las alertas llegan por email; Telegram es opcional en los dos servicios.

## `/api/health`

Ruta del servidor (`app/api/health/route.ts`, lógica en `lib/health.ts`) que se ejecuta en cada petición, sin caché:

| Comprobación | Correcto si | Detecta |
|---|---|---|
| `auth` | `GET /auth/v1/health` responde 200 | Proyecto de Supabase caído o **pausado** (el plan gratuito pausa tras una semana sin actividad) |
| `baseDeDatos` | Leer `sesiones` con la clave pública devuelve el error de permisos `42501` | PostgreSQL caído o PostgREST sin conexión, y **RLS o permisos rotos**: si la clave pública pudiera leer datos, el check falla |

Responde `200` con el detalle si todo va bien y `503` si algo falla:

```json
{"ok":true,"comprobaciones":{"auth":{"ok":true,"ms":237,"detalle":"HTTP 200"},"baseDeDatos":{"ok":true,"ms":369,"detalle":"HTTP 401"}},"comprobadoEn":"…"}
```

No expone datos: solo estados, tiempos y códigos HTTP. Cada comprobación tiene un *timeout* de 5 s para que el monitor reciba un 503 claro en vez de quedarse esperando.

## Dead man's switch de los backups

Los workflows `backup.yml` y `restore-test.yml` hacen ping a Healthchecks.io al empezar (`/start`) y al terminar: a la URL base si fue bien, a `/fail` si falló. Así se detectan dos tipos de problema distintos:

- **El workflow se ejecuta y falla** → llega `/fail` → alerta inmediata (GitHub también envía un email).
- **El workflow no llega a ejecutarse** (cron desactivado, workflow borrado, GitHub Actions caído) → no llega ningún ping → alerta cuando pasa el plazo. GitHub no avisa de esto: por eso hace falta un servicio externo.

Si los secrets `HEALTHCHECKS_BACKUP_URL` / `HEALTHCHECKS_RESTORE_URL` no están configurados, los pasos de ping se saltan y el workflow funciona igual.

## Configuración (una vez)

### Healthchecks.io

1. Crear cuenta en <https://healthchecks.io> (plan gratuito: 20 checks).
2. Crear dos checks:

   | Nombre | Schedule | Period | Grace |
   |---|---|---|---|
   | `timbre-backup` | Simple | 1 day | 1 hour |
   | `timbre-restore-test` | Simple | 7 days | 12 hours |

3. Copiar la *ping URL* de cada uno (`https://hc-ping.com/…`) como secrets del repositorio: `HEALTHCHECKS_BACKUP_URL` y `HEALTHCHECKS_RESTORE_URL`. Son secretas: quien las tenga puede marcar el check como correcto.

### UptimeRobot

1. Crear cuenta en <https://uptimerobot.com> (plan gratuito: 50 monitores, cada 5 min).
2. *New monitor* → **HTTP(s)** → URL `https://<dominio>/api/health`, intervalo 5 min.
3. En *Alert contacts*, el email (y Telegram si se quiere).

## Producción

- UptimeRobot vigila `/api/health` de producción desde el 14-10-2026, cuando se activó RLS ([runbook](./runbook-activar-rls.md)). Antes vigilaba solo `/`: sin RLS, `baseDeDatos` habría fallado siempre.
- Los checks de Healthchecks.io de producción son aparte (`timbre-prod-backup`, `timbre-prod-restore-test`), con sus secrets en el repositorio privado.
