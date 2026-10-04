import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
  {
    rules: {
      // 18 §4: raw HTML injection is banned (JsonLd is the only reviewed exception).
      "react/no-danger": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-restricted-syntax": [
        "error",
        {
          // 18 §4: Prisma unsafe raw queries are banned.
          selector: "CallExpression[callee.property.name=/^\\$(queryRawUnsafe|executeRawUnsafe)$/]",
          message: "Use tagged $queryRaw / TypedSQL instead (18-security §4).",
        },
      ],
    },
  },
  {
    // Feature components: client-reachable, so no server modules except Server Actions (07 §4).
    files: ["src/features/*/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/server/*"],
              message: "Server-only module; call a Server Action instead.",
            },
            {
              group: ["@/features/*/server/*", "!@/features/*/server/actions"],
              message: "Components may import only Server Actions from features/*/server.",
            },
          ],
        },
      ],
    },
  },
  {
    // Primitives/layout: no server modules and no feature logic.
    // (One block per glob: flat config replaces, not merges, a rule's options.)
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/server/*"],
              message: "Server-only module; call a Server Action instead.",
            },
            { group: ["@/features/*"], message: "components/* must not depend on features." },
          ],
        },
      ],
    },
  },
]);
