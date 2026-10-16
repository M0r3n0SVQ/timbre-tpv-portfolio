# Backups de la base de datos

| | |
|---|---|
| **Qué** | Esquema `public` completo: tablas, datos, RLS, políticas y permisos |
| **Cuándo** | Programado a las 03:00 UTC, pero GitHub retrasa los cron: en la práctica empieza hacia las 07:30–08:10 UTC |
| **Dónde** | Artifacts de GitHub Actions, 30 días de retención |
| **Cifrado** | [age](https://age-encryption.org/), clave pública en el workflow de backup y privada solo en el de restauración |
| **Prueba de restauración** | Cada lunes, sobre el último backup, en un PostgreSQL vacío |
| **RPO** (datos que se pueden perder) | Hasta 24 h: lo ocurrido desde el último backup |

La copia que hace la propia app en la tabla `backups` es otra cosa: protege frente a errores de uso durante el día, pero vive en la misma base de datos y no sirve si se pierde.

## Cómo funciona

```
backup.yml (diario)
  pg_dump --schema=public --format=custom ─► age (clave pública) ─► artifact .dump.age
  conteo.sql ─► manifest.json (filas por tabla, sin datos sensibles)

restore-test.yml (semanal)
  último artifact ─► age (clave privada) ─► pg_restore en PostgreSQL 17 vacío
  conteo.sql + seguridad.sql ─► verify.py: mismas tablas, mismas filas, RLS activo, anon sin acceso
```

- **Conexión:** por el *Session pooler* de Supabase. La conexión directa del plan gratuito solo funciona por IPv6, y los runners de GitHub no tienen IPv6.
- **Cifrado asimétrico:** el job de backup solo puede cifrar. Aunque se viera comprometido, no podría leer los backups anteriores.
- **El volcado nunca se escribe en claro en disco:** va de `pg_dump` a `age` por una tubería.
- **Herramientas:** `pg_dump`, `pg_restore` y `psql` se ejecutan con la imagen `postgres:17` de Docker, para no depender de la versión instalada en el runner.

## Configuración (una vez)

### 1. Par de claves de age

En Windows:

```bash
winget install FiloSottile.age
age-keygen -o timbre-backup.key
```

- La línea `# public key: age1…` es la clave **pública**.
- El archivo completo es la clave **privada**: guárdalo en el gestor de contraseñas y borra el archivo. **Si se pierde, los backups no se pueden descifrar.**

### 2. Cadena de conexión

Supabase → proyecto → **Connect** → **Session pooler** → copiar la URI y sustituir `[YOUR-PASSWORD]` por la contraseña de la base de datos.

### 3. GitHub (repo → Settings → Secrets and variables → Actions)

| Tipo | Nombre | Valor |
|---|---|---|
| Variable | `AGE_RECIPIENT` | Clave pública (`age1…`) |
| Secret | `AGE_SECRET_KEY` | Contenido completo del archivo de clave privada |
| Secret | `SUPABASE_DB_URL` | URI del Session pooler, con la contraseña |

### 4. Primera ejecución

Actions → **Backup de la base de datos** → *Run workflow*. Cuando termine: Actions → **Prueba de restauración** → *Run workflow*.

## Producción

El repositorio de portfolio hace backup del proyecto de **demo**. Para producción, los mismos `.github/workflows/backup.yml`, `restore-test.yml` y `scripts/backup/` se copian al **repositorio privado** de producción, con sus propios secrets. Los artifacts de un repositorio público los puede descargar cualquiera; aunque estén cifrados, no hay por qué exponerlos.

## Runbook: restaurar después de perder la base de datos

Con `age` y Docker instalados, en Git Bash:

1. **Elegir el backup.** Actions → *Backup de la base de datos* → la ejecución deseada → descargar el artifact y descomprimirlo.
2. **Preparar el destino.**
   - Si el proyecto de Supabase sigue existiendo pero los datos están mal: crear un proyecto nuevo es más seguro que restaurar encima.
   - En el proyecto nuevo: Authentication → crear la cuenta del bar y desactivar el registro (ver [runbook de RLS](./runbook-activar-rls.md)), y activar Realtime en las tablas tras restaurar.
3. **Restaurar:**

   ```bash
   AGE_KEY_FILE=timbre-backup.key scripts/backup/restore.sh backup-…/timbre-….dump.age "postgresql://…session pooler del proyecto nuevo…"
   ```

4. **Verificar** que las filas coinciden con `manifest.json`:

   ```bash
   docker run --rm -i postgres:17 psql "postgresql://…" -AtX -f - < scripts/backup/conteo.sql
   ```

5. **Apuntar la app al proyecto nuevo:** en Vercel, actualizar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, y volver a desplegar. Iniciar sesión de nuevo en los dispositivos del bar.
6. Borrar la clave privada del disco.

## Limitaciones conocidas

- **Cuentas de usuario:** el backup no incluye `auth.users`. Solo hay una cuenta, la del bar, y se vuelve a crear a mano.
- **Retención:** 30 días como máximo, y solo en GitHub. Un segundo destino fuera de GitHub (un bucket S3/B2) sería la siguiente mejora.
- **Consistencia del manifiesto:** las filas se cuentan justo después del volcado, no en la misma transacción. En el proyecto de demo casi no hay escrituras, y en producción el backup empieza hacia las 10:00, antes de que abra el bar (12:00), así que coinciden. Si GitHub lo retrasara más de dos horas, podría coincidir con la apertura. Si alguna vez la prueba falla por pocas filas en una tabla, este es el primer sospechoso.
- **Proyectos pausados:** Supabase pausa los proyectos gratuitos tras una semana sin actividad. Si eso pasa, el backup fallará y GitHub enviará un email.
