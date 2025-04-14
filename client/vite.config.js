import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/', // Adjust this if deployed under a subdirectory
  plugins: [react()]
});