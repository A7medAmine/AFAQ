import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  assetsInclude: ['**/*.glb'],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: they change far less often than app code,
        // so returning visitors keep them cached across deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api/upload': 'http://localhost:3001',
      '/api/page-content': 'http://localhost:3001',
      '/api/admin': 'http://localhost:3001',
      '/api/email': 'http://localhost:3001',
      '/api/approve': 'http://localhost:3001',
      '/api/members': 'http://localhost:3001',
      '/api/register': 'http://localhost:3001',
      '/api/events': 'http://localhost:3001',
      '/api/ai': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/api/ai-knowledge': 'http://localhost:3001',
      '/api/club-info': 'http://localhost:3001',
      '/api/progres': 'http://localhost:3001',
      '/api/stats': 'http://localhost:3001',
      '/api/digikey': 'http://localhost:3001',
      '/api/admin/check-email': 'http://localhost:3001',
    },
  },
});
