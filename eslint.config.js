import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json", sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      // The whole point of S7: dynamic values must never reach the HTML parser.
      "no-restricted-properties": [
        "error",
        { object: "element", property: "innerHTML", message: "Use textContent or createElement (S7)." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message: "innerHTML is banned: build nodes with createElement/textContent (S7).",
        },
        {
          selector: "MemberExpression[property.name='outerHTML']",
          message: "outerHTML is banned: build nodes with createElement/textContent (S7).",
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: "insertAdjacentHTML is banned (S7).",
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
    },
  },
];
