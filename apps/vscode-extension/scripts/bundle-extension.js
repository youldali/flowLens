import * as esbuild from "esbuild";

await esbuild.build({
  bundle: true,
  entryPoints: ["src/extension/index.ts"],
  external: ["vscode", "typescript-native/async"],
  banner: { js: 'const flowlensModuleUrl = require("node:url").pathToFileURL(__filename).href;' },
  define: { 'import.meta.url': 'flowlensModuleUrl' },
  format: "cjs",
  logLevel: "info",
  minify: true,
  outfile: "dist/extension.cjs",
  platform: "node",
  sourcemap: false,
  target: "node20",
});
