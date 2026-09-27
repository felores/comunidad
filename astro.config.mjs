import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import node from "@astrojs/node";

export default defineConfig({
  adapter: node({ mode: "standalone" }),
  integrations: [mdx()],
  output: "static",
  security: {
    checkOrigin: true,
  },
  server: {
    host: "127.0.0.1",
  },
});
