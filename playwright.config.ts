import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:1420",
    viewport: { width: 1366, height: 768 },
    channel: "msedge",
    headless: true,
    screenshot: "only-on-failure",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/browser-results.json" }],
  ],
});
