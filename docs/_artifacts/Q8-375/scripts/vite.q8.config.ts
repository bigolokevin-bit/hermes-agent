// THROWAWAY dev-runner config for the Q8 375px read-only audit. NOT product code.
// Extends the repo's real web/vite.config.ts ONLY to add an `/agent-api` proxy:
// this tree's vite.config proxies `/api`→hermes dashboard (9119) but the console
// modules fetch `/agent-api/api/*`, which has no in-tree dev proxy. We route it to
// the managed-preview face 9122 (l7-ops v4_proxy: strips /agent-api → console BFF
// 8092; validates opsadmin access_token_cookie against auth upstream 7860).
// Run from the web/ dir:  node_modules/.bin/vite --config <this file>
import { mergeConfig } from "vite";
import baseConfig from "/Users/kevin_studio/Projects/tasks/Q8-375-pages/web/vite.config";

export default mergeConfig(baseConfig, {
  server: {
    port: 5199,
    strictPort: true,
    host: "127.0.0.1",
    proxy: { "/agent-api": { target: "http://127.0.0.1:9122", changeOrigin: false } },
  },
});
