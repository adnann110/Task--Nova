import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
    },

    preview: {
      host: "0.0.0.0",
      allowedHosts: true,
      port: Number(process.env.PORT) || 3000,
    },
  },

  tanstackStart: {
    server: { entry: "server" },
  },
});
