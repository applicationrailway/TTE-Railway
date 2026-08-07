import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path"; // 💡 Removed vite-tsconfig-paths import

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    tsconfigPaths: true, // 💡 Added native path resolution here
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  ssr: {
    noExternal: ['firebase', 'firebase/auth', 'firebase/app', 'firebase/firestore']
  },
  define: {
    'process.env': {}
  }
});