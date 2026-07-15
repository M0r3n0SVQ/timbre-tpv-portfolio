import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Esta regla (nueva en eslint-plugin-react-hooks v7, viene de serie con
      // Next 16) marca como error el patrón estándar de "cargar datos en un
      // useEffect al montar", que usan a propósito los 4 hooks de datos de
      // la app (useCuentas, useCobros, useSesion, useComandas) y funciona
      // bien. Se deja en warning para que siga siendo visible sin bloquear
      // el build ni el CI por un patrón intencionado.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
