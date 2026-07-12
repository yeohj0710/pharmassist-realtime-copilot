import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  envDir: "../..",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [],
      manifest: {
        name: "PharmAssist Realtime Copilot Demo",
        short_name: "PharmAssist",
        description: "합성 데이터 기반 비임상 데모",
        theme_color: "#191f28",
        background_color: "#f2f4f6",
        display: "standalone",
        lang: "ko-KR",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html}"],
      },
    }),
  ],
  server: { strictPort: true },
  preview: { host: "0.0.0.0", port: 4173, strictPort: true },
});
