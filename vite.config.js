import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Mirrors the production nginx proxy: `/kroki/<path>` ->
      // `http://127.0.0.1:8000/<path>`. Start only Kroki with
      // `docker compose -f docker-compose.dev.yml up -d kroki`.
      '/kroki': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kroki/, ''),
      },
    },
  },
})
