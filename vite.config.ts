import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react";
          }

          if (id.includes("@supabase")) {
            return "vendor-supabase";
          }

          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }

          if (id.includes("react-router-dom")) {
            return "vendor-router";
          }

          if (id.includes("@tanstack/react-query")) {
            return "vendor-query";
          }

          if (id.includes("recharts")) {
            return "vendor-recharts";
          }

          if (id.includes("/d3-")) {
            return "vendor-d3";
          }

          if (id.includes("date-fns")) {
            return "vendor-date";
          }

          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }

          if (id.includes("@dnd-kit")) {
            return "vendor-dnd";
          }

          if (
            id.includes("react-transition-group") ||
            id.includes("react-is") ||
            id.includes("dom-helpers")
          ) {
            return "vendor-transition";
          }

          if (id.includes("react-day-picker")) {
            return "vendor-daypicker";
          }

          if (id.includes("embla-carousel-react") || id.includes("embla-carousel")) {
            return "vendor-embla";
          }

          if (id.includes("vaul")) {
            return "vendor-vaul";
          }

          if (id.includes("react-resizable-panels")) {
            return "vendor-panels";
          }

          if (id.includes("input-otp")) {
            return "vendor-input-otp";
          }

          if (id.includes("next-themes")) {
            return "vendor-themes";
          }

          if (id.includes("sonner")) {
            return "vendor-sonner";
          }

          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform/resolvers") ||
            id.includes("/zod/")
          ) {
            return "vendor-forms";
          }

          return "vendor-misc";
        },
      },
    },
  },
}));
