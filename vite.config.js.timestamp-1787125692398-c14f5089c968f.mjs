// vite.config.js
import { defineConfig } from "file:///D:/cnb/memox_web/node_modules/vite/dist/node/index.js";
import vue from "file:///D:/cnb/memox_web/node_modules/@vitejs/plugin-vue/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [vue()],
  // jSquash ships WASM loaded relative to import.meta.url. Excluding it from dep
  // pre-bundling lets Vite emit those .wasm assets correctly (both in the worker
  // and the main bundle). assetsInclude keeps .wasm as a handled asset type.
  optimizeDeps: {
    exclude: ["@jsquash/jpeg", "@jsquash/webp", "@jsquash/png", "@jsquash/oxipng", "@jsquash/resize"]
  },
  assetsInclude: ["**/*.wasm"],
  worker: {
    format: "es"
  },
  server: {
    port: 3e3
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxjbmJcXFxcbWVtb3hfd2ViXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxjbmJcXFxcbWVtb3hfd2ViXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9jbmIvbWVtb3hfd2ViL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCB2dWUgZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlJ1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbdnVlKCldLFxuICAvLyBqU3F1YXNoIHNoaXBzIFdBU00gbG9hZGVkIHJlbGF0aXZlIHRvIGltcG9ydC5tZXRhLnVybC4gRXhjbHVkaW5nIGl0IGZyb20gZGVwXG4gIC8vIHByZS1idW5kbGluZyBsZXRzIFZpdGUgZW1pdCB0aG9zZSAud2FzbSBhc3NldHMgY29ycmVjdGx5IChib3RoIGluIHRoZSB3b3JrZXJcbiAgLy8gYW5kIHRoZSBtYWluIGJ1bmRsZSkuIGFzc2V0c0luY2x1ZGUga2VlcHMgLndhc20gYXMgYSBoYW5kbGVkIGFzc2V0IHR5cGUuXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnQGpzcXVhc2gvanBlZycsICdAanNxdWFzaC93ZWJwJywgJ0Bqc3F1YXNoL3BuZycsICdAanNxdWFzaC9veGlwbmcnLCAnQGpzcXVhc2gvcmVzaXplJ10sXG4gIH0sXG4gIGFzc2V0c0luY2x1ZGU6IFsnKiovKi53YXNtJ10sXG4gIHdvcmtlcjoge1xuICAgIGZvcm1hdDogJ2VzJyxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMzAwMCxcbiAgfSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXdPLFNBQVMsb0JBQW9CO0FBQ3JRLE9BQU8sU0FBUztBQUVoQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsSUFBSSxDQUFDO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFJZixjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsaUJBQWlCLGlCQUFpQixnQkFBZ0IsbUJBQW1CLGlCQUFpQjtBQUFBLEVBQ2xHO0FBQUEsRUFDQSxlQUFlLENBQUMsV0FBVztBQUFBLEVBQzNCLFFBQVE7QUFBQSxJQUNOLFFBQVE7QUFBQSxFQUNWO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDUjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
