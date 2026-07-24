import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": backendTarget,
      "/images": backendTarget,
      "/uploads": backendTarget,
    },
  },
  preview: {
    proxy: {
      "/api": backendTarget,
      "/images": backendTarget,
      "/uploads": backendTarget,
    },
  },
});
