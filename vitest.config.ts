import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "next/link": fileURLToPath(new URL("./tests/next-link-stub.tsx", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
