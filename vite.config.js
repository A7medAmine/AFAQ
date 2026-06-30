import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  assetsInclude: ['**/*.glb'],
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api/upload': 'http://localhost:3001',
      '/api/page-content': 'http://localhost:3001',
      '/api/admin': 'http://localhost:3001',
      '/api/email': 'http://localhost:3001',
      '/api/approve': 'http://localhost:3001',
      '/api/ai': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/api/ai-knowledge': 'http://localhost:3001',
      '/api/club-info': 'http://localhost:3001',
      '/api/progres': 'http://localhost:3001',
      '/api/stats': 'http://localhost:3001',
      '/api/admin/check-email': 'http://localhost:3001',
    },
  },
});
