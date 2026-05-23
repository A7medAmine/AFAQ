import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  assetsInclude: ['**/*.glb'],
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/upload': 'http://localhost:3001',
      '/api/admin': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
