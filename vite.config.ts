import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Vite enables this automatically in detected coding-agent environments.
    // Keep browser errors in DevTools without adding a second WebSocket transport.
    forwardConsole: false,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
  },
});
