import { defineConfig } from "vitest/config";
import type { EdgeConfig } from "./src/types/config.js";

/**
 * Stand-in for the constant build.mjs bakes into the Lambda@Edge bundle. The JWKS is deliberately
 * empty so tests exercise the runtime JWKS fallback with keys served by a stubbed `fetch`. The
 * gate takes its configuration as an argument, so it needs no stand-in here.
 */
const testConfig: EdgeConfig = {
  region: "ap-southeast-2",
  userPoolId: "ap-southeast-2_TestPool",
  clientId: "test-client-id",
  hostedUiDomain: "test-auth.auth.ap-southeast-2.amazoncognito.com",
  jwks: { keys: [] },
  flowKey: "test-only-flow-key",
  sessionKey: "test-only-session-key",
};

export default defineConfig({
  define: {
    EDGE_CONFIG: JSON.stringify(testConfig),
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      // Type-only declarations and the thin runtime entry points carry no logic worth asserting:
      // index.ts just wires the handler to the baked-in config, types/ is interfaces only.
      exclude: ["src/types/**", "src/**/index.ts"],
    },
  },
});
