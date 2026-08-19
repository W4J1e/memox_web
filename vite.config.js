import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // jSquash ships WASM loaded relative to import.meta.url. Excluding it from dep
  // pre-bundling lets Vite emit those .wasm assets correctly (both in the worker
  // and the main bundle). assetsInclude keeps .wasm as a handled asset type.
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/webp', '@jsquash/png', '@jsquash/oxipng', '@jsquash/resize'],
  },
  assetsInclude: ['**/*.wasm'],
  worker: {
    format: 'es',
  },
  server: {
    port: 3000,
  },
})
