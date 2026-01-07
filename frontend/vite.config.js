import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/', // Updated for Synology WebStation Alias
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3006, // Changed to 3006 to avoid Windows Hyper-V reserved ports (EACCES on 5173)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, '') // NO rewrite needed because backend expects /api prefix now (except for WS may need care)
      },
      '/api/ws': { // Explicitly handle WebSocket if needed, though Upgrade header usually handled
        target: 'ws://127.0.0.1:8080',
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/ws/, '/ws') // Backend ws is at /ws, Frontend calls /api/ws
      }
    }
  },
})
