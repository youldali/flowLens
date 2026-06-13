import { spawn } from "node:child_process";

const packageManager = process.env.npm_execpath;

if (!packageManager) {
  throw new Error("Could not determine package manager from npm_execpath.");
}

const build = spawn(
  process.execPath,
  [packageManager, "--filter", "frontend", "build"],
  { stdio: "inherit" },
);

build.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

build.on("error", (error) => {
  throw error;
});
