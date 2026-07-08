import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** production HTML shell बाट generator comment हटाउँछ। */
function stripGeneratorMeta(): Plugin {
  return {
    name: "strip-generator-meta",
    transformIndexHtml(html) {
      return html.replace(/<!--.*?-->/gs, "");
    },
    apply: "build",
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/ws": { target: "ws://127.0.0.1:8000", ws: true },
      "/media": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "production" && stripGeneratorMeta(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  optimizeDeps: {
    include: ["react-leaflet", "@react-leaflet/core", "leaflet"],
  },
  build: {
    sourcemap: false,
    minify: "esbuild",
    cssMinify: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[hash].js",
        chunkFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash][extname]",
      },
    },
  },
  esbuild: {
    legalComments: "none",
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));
