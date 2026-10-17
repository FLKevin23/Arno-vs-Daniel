import { defineConfig } from "vite";

// The site is served from https://flkevin23.github.io/Arno-vs-Daniel/, so every
// asset URL needs that prefix. GitHub Pages paths are case-sensitive.
export default defineConfig({
  base: "/Arno-vs-Daniel/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        // One vendor chunk for the Firebase SDK keeps the app chunk small and
        // cacheable across deploys.
        manualChunks: (id) => (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase") ? "firebase" : undefined),
      },
    },
  },
});
