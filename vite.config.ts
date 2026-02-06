import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        // Reduce the single entry chunk size by splitting vendor deps by package.
        // This prevents a regression back to a multi-megabyte main chunk and removes
        // the default 500k chunk warning without hiding it via chunkSizeWarningLimit.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          const segments = id.split("node_modules/")[1]?.split("/") ?? [];
          if (segments.length === 0) return;

          const pkgName = segments[0].startsWith("@")
            ? `${segments[0]}/${segments[1] ?? ""}`.replace(/\/$/, "")
            : segments[0];

          // Avoid creating known-empty chunks due to tree-shaken packages.
          if (["detect-node-es", "dom-helpers", "micromark-util-encode"].includes(pkgName)) return;

          const safe = pkgName
            .replace(/^@/, "")
            .replaceAll("/", "-")
            .replaceAll(".", "-")
            .replaceAll("@", "");

          return `vendor-${safe || "vendor"}`;
        },
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Control Horario - Kiosco",
        short_name: "Kiosco",
        description: "Sistema de fichaje para terminales",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "portrait",
        start_url: "/kiosk",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    force: true,
  },
}));
