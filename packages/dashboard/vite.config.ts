import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Local-dev proxy: forwards /api and /socket.io to the API server
    // so the browser never needs to know about port 3000.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    // Raise the chunk-size warning threshold slightly to suppress the
    // recharts/socket.io chunks that are already being split correctly.
    chunkSizeWarningLimit: 600,
  },
})
