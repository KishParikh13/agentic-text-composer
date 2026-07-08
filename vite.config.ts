import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist/public' },
  server: {
    proxy: {
      '/api': 'http://localhost:4300',
      '/ws': { target: 'ws://localhost:4300', ws: true },
    },
  },
})
