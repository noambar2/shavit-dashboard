import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      // ECharts alone is ~550 kB; it's split into its own cached chunk below.
      chunkSizeWarningLimit: 700,
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
