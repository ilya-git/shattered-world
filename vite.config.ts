import { defineConfig } from 'vite';

// base: './' keeps asset paths relative so the built site works from any
// static host or sub-path (e.g. GitHub Pages project sites).
export default defineConfig({
  base: './',
});
