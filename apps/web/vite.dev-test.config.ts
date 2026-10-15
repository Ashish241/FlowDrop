import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";
export default defineConfig(async (env) =>
  mergeConfig(typeof base === "function" ? await base(env) : base, {
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      proxy: {
        "/signal": {
          target: "http://127.0.0.1:8772",
          ws: true,
          rewrite: (path: string) => path.replace(/^\/signal/, ""),
        },
      },
    },
  }),
);
