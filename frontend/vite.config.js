import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/predict": "http://localhost:8000",
      "/explain": "http://localhost:8000",
      "/alerts": "http://localhost:8000",
      "/fault-type": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
});
