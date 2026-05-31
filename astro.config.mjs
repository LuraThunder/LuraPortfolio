import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://quickbrown.net",
  output: "static",
  vite: {
    cacheDir: ".vite-cache",
  },
});
