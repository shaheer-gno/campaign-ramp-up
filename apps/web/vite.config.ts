import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Allow ngrok / other tunnels when sharing a demo
    allowedHosts: true,
    proxy: { '/api': { target: 'http://localhost:3011', changeOrigin: true } },
  },
});
