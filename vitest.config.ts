import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": r("./src"),
      // `server-only` throws outside the react-server condition; tests exercise server modules directly.
      "server-only": r("./test/stubs/server-only.ts"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/app/**", "src/generated/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          // Component tests opt into jsdom with a `// @vitest-environment jsdom` docblock.
          include: ["src/**/*.test.{ts,tsx}", "prisma/**/*.test.ts", "scripts/**/*.test.ts"],
          exclude: ["**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: [
            "src/**/*.int.test.ts",
            "prisma/**/*.int.test.ts",
            "test/integration/**/*.int.test.ts",
          ],
          globalSetup: ["./test/integration/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 120_000,
          // One shared database: run files sequentially for deterministic data.
          fileParallelism: false,
        },
      },
    ],
  },
});
