import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", ".codex-pr-build/**", "out/**", "build/**", "next-env.d.ts", "Lekta/**"]),
]);

export default eslintConfig;
