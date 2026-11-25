import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      // Backend runs on 8737; changeOrigin keeps the Host header on 127.0.0.1 (DNS rebinding guard)
      '/api': { target: 'http://127.0.0.1:8737', changeOrigin: true },
    },
  },
})
