import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    base: "./",
    server: {
      host: true,
      port: 5173,
      allowedHosts: ["180.93.52.86", "127.0.0.1"],
    },
    define: {
      "import.meta.env.VITE_GOOGLE_API_KEY": JSON.stringify(
        env.VITE_GOOGLE_API_KEY || "",
      ),
      "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify(
        env.VITE_GOOGLE_CLIENT_ID || "",
      ),
      "import.meta.env.VITE_GOOGLE_SHEET_URL": JSON.stringify(
        env.VITE_GOOGLE_SHEET_URL || "",
      ),
      "import.meta.env.VITE_GOOGLE_SHEET_TAB": JSON.stringify(
        env.VITE_GOOGLE_SHEET_TAB || "Trang tính1",
      ),
      "import.meta.env.VITE_ZERNIO_API_KEY_TIKTOK": JSON.stringify(
        env.VITE_ZERNIO_API_KEY_TIKTOK || "",
      ),
      "import.meta.env.VITE_ZERNIO_API_KEY_YOUTUBE": JSON.stringify(
        env.VITE_ZERNIO_API_KEY_YOUTUBE || "",
      ),
      "import.meta.env.VITE_TIKTOK_ACCOUNT_ID": JSON.stringify(
        env.VITE_TIKTOK_ACCOUNT_ID || "",
      ),
      "import.meta.env.VITE_YOUTUBE_ACCOUNT_ID": JSON.stringify(
        env.VITE_YOUTUBE_ACCOUNT_ID || "",
      ),
      "import.meta.env.VITE_BACKEND_TOOL_URL": JSON.stringify(
        env.VITE_BACKEND_TOOL_URL || "https://video.cmicstudio.shop",
      ),
    },
  };
});
