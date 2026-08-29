import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        browser: true,
        es2022: true,
        node: true,
        React: "readonly"
      },
      parser: await import("typescript-eslint").then(mod => mod.parser)
    },
    settings: {
      react: { version: "19" }
    },
    plugins: {
      react: reactPlugin,
      "@typescript-eslint": (await import("typescript-eslint")).plugin
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }]
    }
  },
  {
    ignores: ["node_modules/", ".next/", "out/", "dist/", "*.config.*", "*.d.ts", "eslint.config.mjs"]
  }
];