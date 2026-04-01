import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const appUrl = process.env.SHOPIFY_APP_URL || "http://localhost";
const host = new URL(appUrl).hostname;
const port = Number(process.env.PORT || 3000);

// 🔥 FIX: REMOVE STATIC PORT CONFLICT
const hmrConfig =
  host === "localhost"
    ? {
        protocol: "ws",
        host: "localhost",
      }
    : {
        protocol: "wss",
        host,
        clientPort: 443,
      };

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    allowedHosts: [
      host,
      ".trycloudflare.com",
      "app.maddoptions.com",
      "localhost",
      "127.0.0.1",
    ],
    cors: {
      preflightContinue: true,
    },
    hmr: hmrConfig,
  },
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react"],
  },
});