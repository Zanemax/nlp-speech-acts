import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import netlify from "@netlify/vite-plugin";

// The Netlify plugin emulates platform primitives (Functions, env) under the
// plain `vite` dev server, so `/api/generate` works without a separate process.
export default defineConfig({
  plugins: [react(), netlify()],
  server: {
    // Use the port assigned via PORT when one is provided, so the dev server
    // doesn't collide with anything already holding Vite's default.
    port: Number(process.env.PORT) || undefined,
  },
});
