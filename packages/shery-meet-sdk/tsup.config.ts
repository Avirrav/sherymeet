import { defineConfig } from "tsup";

export default defineConfig([
  // ESM and CJS builds
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    minify: false,
  },
  // UMD/IIFE build for browser script tag
  {
    entry: ["src/index.ts"],
    format: ["iife"],
    globalName: "SheryMeetSDK",
    outDir: "dist",
    outExtension: () => ({ js: ".global.js" }),
    minify: true,
    sourcemap: true,
    platform: "browser",
    footer: {
      js: "window.SheryMeet = SheryMeetSDK.SheryMeet;",
    },
  },
]);
