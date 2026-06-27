import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// База '' → относительные пути в dist (отдаём статикой из nginx).
export default defineConfig({
  plugins: [react()],
  base: '',
  server: {
    port: 5183,
    proxy: {
      '/api': 'http://127.0.0.1:8011',
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
})
