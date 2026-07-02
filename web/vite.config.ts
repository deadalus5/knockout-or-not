import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.KO_BASE ?? '/',
  plugins: [react()],
})
