import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/v1': 'http://localhost:8080',
    },
    allowedHosts: [
      'localhost',
      '9ee2-72-252-149-207.ngrok-free.app',
    ]
  },
})
