import { spawn } from "node:child_process";

if (process.env.FLOWLENS_SKIP_VSCE_PREPUBLISH !== "1") {
  await run("pnpm", ["run", "build"]);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });

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
