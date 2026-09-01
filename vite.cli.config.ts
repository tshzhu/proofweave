import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: "dist-cli",
    rollupOptions: {
      output: {
        entryFileNames: "proofweave.js",
        format: "es",
      },
    },
    ssr: "src/cli.ts",
  },
});
