import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Note: worker format is left at Vite's default (classic/iife). The Pyodide
// worker in public/ is a classic worker loaded with `new Worker(url)`, so
// `importScripts` works. Do not set worker.format: 'es' here.
export default defineConfig({
  plugins: [react()],
});
