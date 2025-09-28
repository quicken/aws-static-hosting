import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import viteTsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    base: env.VITE_AUTH_BASE_PATH,
    build: {
      manifest: true,
    },
    plugins: [react(), viteTsconfigPaths()],
    server: {
      open: true,
      port: 3000,
    },
    preview: {
      port: 3000,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      exclude: ['**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**']
    },
  };
});
