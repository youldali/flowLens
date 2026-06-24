import * as esbuild from "esbuild";

await esbuild.build({
  bundle: true,
  entryPoints: ["src/extension.ts"],
  external: ["vscode"],
  format: "esm",
  logLevel: "info",
  minify: true,
  outfile: "dist/extension.js",
  platform: "node",
  sourcemap: false,
  target: "node20",
});
