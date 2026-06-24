import { spawn } from "node:child_process";

const packageManager = process.env.npm_execpath;

if (!packageManager) {
  throw new Error("Could not determine package manager from npm_execpath. Run this script through a package.json script.");
}

await run(process.execPath, [packageManager, "run", "build"]);
await run("vsce", ["package", "--no-dependencies"], {
  ...process.env,
  FLOWLENS_SKIP_VSCE_PREPUBLISH: "1",
});

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? 1}.`));
    });

    child.on("error", reject);
  });
}
