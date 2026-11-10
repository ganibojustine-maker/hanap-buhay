import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Port is pinned on purpose: Google OAuth only accepts origins you registered,
// so if 5173 is busy we must FAIL instead of silently moving to 5174/5175
// (that is what caused "Error 400: origin_mismatch").
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy /api/* calls to the PHP backend so CORS is never an issue in dev
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: { host: 'localhost', port: 5173, strictPort: true },
})
