import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(extensionRoot, "../..");
const frontendDist = path.join(workspaceRoot, "apps/frontend/dist");
const webviewDist = path.join(extensionRoot, "media/frontend");

await fs.rm(webviewDist, { force: true, recursive: true });
await fs.mkdir(path.dirname(webviewDist), { recursive: true });
await fs.cp(frontendDist, webviewDist, { recursive: true });
