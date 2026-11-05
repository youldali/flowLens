import * as esbuild from "esbuild";

await esbuild.build({
  bundle: true,
  entryPoints: ["src/extension/index.ts"],
  external: ["vscode", "typescript-native/async"],
  // Bundled CommonJS dependencies still require Node built-ins at runtime.
  banner: { js: 'import { createRequire as flowlensCreateRequire } from "node:module"; const require = flowlensCreateRequire(import.meta.url);' },
  format: "esm",
  logLevel: "info",
  // Prefer statically analyzable ESM over UMD wrappers such as jsonc-parser's.
  mainFields: ["module", "main"],
  minify: true,
  outfile: "dist/extension.mjs",
  platform: "node",
  sourcemap: false,
  target: "node20",
});
