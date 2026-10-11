"""Compara lo restaurado con el manifiesto del backup. Sale con 1 si algo no cuadra.

Uso: python3 scripts/backup/verify.py <manifest.json> <restaurado.json> <seguridad.json>
"""

import json
import os
import sys


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # para los emojis en Windows
    manifest_path, restaurado_path, seguridad_path = sys.argv[1:4]
    esperado = json.load(open(manifest_path, encoding="utf-8"))["tablas"]
    obtenido = json.load(open(restaurado_path, encoding="utf-8"))["tablas"]
    seguridad = json.load(open(seguridad_path, encoding="utf-8"))

    filas = []
    errores = []
    for tabla in sorted(set(esperado) | set(obtenido)):
        e, o = esperado.get(tabla), obtenido.get(tabla)
        seg = seguridad.get(tabla, {})
        ok = e == o and seg.get("rls") is True and seg.get("anon_lee") is False
        if e != o:
            errores.append(f"{tabla}: esperadas {e} filas, restauradas {o}")
        if seg.get("rls") is not True:
            errores.append(f"{tabla}: RLS desactivado tras restaurar")
        if seg.get("anon_lee") is not False:
            errores.append(f"{tabla}: anon puede leerla tras restaurar")
        filas.append(f"| `{tabla}` | {e} | {o} | {seg.get('rls')} | {seg.get('anon_lee')} | {'✅' if ok else '❌'} |")

    if not esperado:
        errores.append("El manifiesto no tiene ninguna tabla")

    resumen = "\n".join([
        "## Prueba de restauración",
        "",
        "| Tabla | Filas en backup | Filas restauradas | RLS | anon puede leer | |",
        "|---|---|---|---|---|---|",
        *filas,
        "",
        "**Resultado:** " + ("✅ correcta" if not errores else "❌ " + "; ".join(errores)),
    ])
    print(resumen)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(resumen + "\n")

    for error in errores:
        print(f"::error::{error}")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
