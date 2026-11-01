import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // GitHub Pages serves the site from /<repo>/; the deploy workflow sets VITE_BASE.
    base: env.VITE_BASE || '/',
    plugins: [vue()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      // ECharts (~580 kB) and ExcelJS (~940 kB, loaded only when exporting) are big libraries in their own chunks.
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: { manualChunks: { echarts: ['echarts', 'vue-echarts', 'zrender'] } },
      },
    },
    server: {
      // When VITE_API_PROXY_TARGET is set, /api requests are forwarded to the real backend.
      proxy: env.VITE_API_PROXY_TARGET
        ? { '/api': { target: env.VITE_API_PROXY_TARGET, changeOrigin: true } }
        : undefined,
    },
  }
})
