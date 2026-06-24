import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import netlify from "@netlify/vite-plugin";

// The Netlify plugin emulates platform primitives (Functions, env) under the
// plain `vite` dev server, so `/api/generate` works without a separate process.
export default defineConfig({
  plugins: [react(), netlify()],
  server: {
    port: 5173,
  },
});
