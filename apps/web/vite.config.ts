import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Minimal, environment-agnostic Vite configuration.
// The dev server binds to 0.0.0.0 so it can run inside a container.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
