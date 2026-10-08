import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    rollupOptions: { output: { inlineDynamicImports: true } },
    chunkSizeWarningLimit: 3000,
    assetsInlineLimit: 100000000,
  },
})
