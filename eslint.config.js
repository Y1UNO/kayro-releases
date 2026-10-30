import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "installer/dist",
      "node_modules",
      "target",
      "src-tauri",
      "spikes",
      "reference",
      "_kit",
      "src/ipc/bindings.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // No hard-coded visible text in components: everything goes through t() (src/i18n).
    files: ["src/**/*.tsx"],
    ignores: ["src/dev/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXText[value=/\\S/]",
          message: "Visible text must come from the i18n catalogue: use t().",
        },
        {
          selector: "JSXAttribute[name.name=/^(aria-label|title|placeholder|alt)$/] > Literal",
          message: "Accessible text must come from the i18n catalogue: use t().",
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
