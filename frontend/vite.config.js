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
    // ВАЖНО: по умолчанию Vite собирает под Chrome 87+, и в бандл попадает `??`.
    // На телефонах со старым системным WebView (например Huawei без сервисов Google,
    // где WebView не обновляется) это синтаксическая ошибка: файл скачивается,
    // но не выполняется ЦЕЛИКОМ — гость видит чёрный экран, запросов к API ноль.
    target: 'es2015',
  },
})
