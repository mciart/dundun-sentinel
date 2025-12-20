import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        // 本地开发时，可以指向已部署的 EdgeOne 地址
        // 例如：target: 'https://你的域名.com'
        // 或者启动本地 API 服务器
        target: 'http://localhost:8787',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  }
})
