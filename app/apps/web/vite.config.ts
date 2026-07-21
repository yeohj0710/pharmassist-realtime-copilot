import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const DEFAULT_LOCAL_PORT = 14273;
const DEFAULT_PREVIEW_PORT = 14373;

export default defineConfig(({ mode }) => {
  const envDirectory = "../..";
  const fileEnv = loadEnv(mode, envDirectory, "");
  const rawPort =
    process.env["PHARMASSIST_WEB_PORT"] ??
    fileEnv["PHARMASSIST_WEB_PORT"] ??
    String(DEFAULT_LOCAL_PORT);
  const localPort = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(localPort) || localPort < 1024 || localPort > 65_535) {
    throw new Error(`Invalid PHARMASSIST_WEB_PORT: ${rawPort}`);
  }

  return {
    envDir: envDirectory,
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
          cacheId: "pharmassist-realtime-copilot",
          navigateFallback: "/index.html",
          globPatterns: ["**/*.{js,css,html}"],
          // The deterministic worker embeds the audited research-preview
          // product/pathway pack so it remains available offline.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
      }),
    ],
    server: { port: localPort, strictPort: true },
    preview: {
      host: "127.0.0.1",
      port: DEFAULT_PREVIEW_PORT,
      strictPort: true,
    },
  };
});
