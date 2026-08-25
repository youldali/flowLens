import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

const packageManager = process.env.npm_execpath ?? "pnpm";

const extensionDir = process.cwd();
const workspaceDir = path.resolve(extensionDir, "../..");
const packageJson = JSON.parse(await readFile(path.join(extensionDir, "package.json"), "utf8"));
const packagePath = path.join(extensionDir, `${packageJson.name}-${packageJson.version}.vsix`);
const stagingDir = await mkdtemp(path.join(tmpdir(), "flowlens-vscode-package-"));
const stagingEnv = {
  ...process.env,
  CI: "true",
};

try {
  await runPackageManager(["--filter", packageJson.name, "build"], process.env, workspaceDir);
  await runPackageManager(["--filter", packageJson.name, "deploy", "--prod", "--legacy", stagingDir], stagingEnv, workspaceDir);
  await run(
    "vsce",
    ["package", "--follow-symlinks", "--out", packagePath],
    {
      ...process.env,
      FLOWLENS_SKIP_VSCE_PREPUBLISH: "1",
    },
    stagingDir,
  );
} finally {
  await rm(stagingDir, { force: true, recursive: true });
}

function run(command, args, env = process.env, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });

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

function runPackageManager(args, env = process.env, cwd = process.cwd()) {
  return process.env.npm_execpath
    ? run(process.execPath, [packageManager, ...args], env, cwd)
    : run(packageManager, args, env, cwd);
}
