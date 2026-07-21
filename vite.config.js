import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// On `build` (production) the app is served from the GitHub Pages subpath
// https://cndcross22.github.io/Birthday-Arete-SW/ ; on `serve` (dev) it's root.
// Must match the GitHub repo name exactly — a mismatch serves a blank page.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Birthday-Arete-SW/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
