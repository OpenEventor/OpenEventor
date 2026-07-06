import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs so the app can be served under any subpath (the server
  // injects a runtime <base href> for reverse-proxy mounts like /oe/).
  base: './',
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:5050',
    },
  },
})
