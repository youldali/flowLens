import { spawn } from "node:child_process";

const packageManager = process.env.npm_execpath;

if (!packageManager) {
  throw new Error(
    "Could not determine package manager from npm_execpath. Run this script through a package.json script, for example with `pnpm run ...`, instead of invoking it directly with node or pnpm exec.",
  );
}

await runPackageScript("@flowlens/analyzer-core", "build");
await runPackageScript("frontend", "build");

function runPackageScript(filter, script) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [packageManager, "--filter", filter, script],
      { stdio: "inherit" },
    );

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      code === 0 ? resolve() : reject(new Error(`${filter} ${script} failed with exit code ${code ?? 1}.`));
    });

    child.on("error", reject);
  });
}
