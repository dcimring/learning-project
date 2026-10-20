import { defineConfig } from "vitest/config";

// Tests import the package by name (`webhook-delivery/receiver`), so they run
// through the public entry points. The `source` export condition points those
// imports at the TypeScript sources instead of the built `dist`.
export default defineConfig({
  resolve: { conditions: ["source"] },
  ssr: { resolve: { conditions: ["source"] } },
  test: { include: ["test/**/*.test.ts"] },
});
