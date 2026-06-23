import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      "/api/sunny": "http://localhost:5001",
      "/api/guest": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/api/rebook": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
