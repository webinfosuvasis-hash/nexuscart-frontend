import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Self-hosted deploy serves the admin under https://nexuscart.surflextechnology.in/admin/
  base: mode === "surflex" ? "/admin/" : "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Two separate apps from one build: the store admin and the vendor portal
  // (vendor.html → src/vendor). They share UI components but no session.
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        vendor: path.resolve(__dirname, "vendor.html"),
      },
    },
  },
}));
