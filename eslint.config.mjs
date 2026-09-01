import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// `eslint-config-next` 15.5.x ne publie encore que des configs au format
// « eslintrc » hérité (objets `module.exports = { extends: [...] }`), pas de
// config plate. On les convertit en config plate via FlatCompat pour ESLint 9,
// exactement comme le fait `create-next-app` pour cette combinaison de versions.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
