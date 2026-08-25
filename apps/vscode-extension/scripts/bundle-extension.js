import * as esbuild from "esbuild";

await esbuild.build({
  bundle: true,
  entryPoints: ["src/extension.ts"],
  external: ["vscode", "typescript"],
  format: "cjs",
  logLevel: "info",
  minify: true,
  outfile: "dist/extension.cjs",
  platform: "node",
  sourcemap: false,
  target: "node20",
});
