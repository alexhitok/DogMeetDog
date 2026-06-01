import { defineConfig } from 'vite';

// Plain HTML/CSS/JS app – no framework plugins needed
export default defineConfig({
  build: {
    rollupOptions: {
      input: 'index.html',
    },
  },
});
