import * as fs from 'node:fs';
import * as path from 'node:path';
import { err, ok, type Result } from 'neverthrow';

export const excludedDirectories: ReadonlySet<string> = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.turbo', '.yarn', '.pnpm', '.cache']);

export function isWithinDirectory(directory: string, filePath: string): boolean {
  const relative = path.relative(directory, filePath);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function findWorkspaceRoot(configPath: string): string {
  const projectDirectory = path.dirname(path.resolve(configPath));
  let directory = projectDirectory;

  while (true) {
    if (declaresWorkspace(directory) || fs.existsSync(path.join(directory, '.git'))) return directory;
    const parent = path.dirname(directory);

    if (parent === directory) return projectDirectory;
    directory = parent;
  }
}

export function findNearestTsconfig(startDir: string): Result<string, "not-found"> {
  let currentDir = startDir;

  while (true) {
    const candidate = path.join(currentDir, 'tsconfig.json');

    if (fs.existsSync(candidate)) {
      return ok(candidate);
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return err("not-found");
    }

    currentDir = parentDir;
  }
}

export function findTsConfigPaths(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory() && !excludedDirectories.has(entry.name)) return findTsConfigPaths(filePath);
    return entry.isFile() && /^tsconfig(?:\..+)?\.json$/.test(entry.name) ? [filePath] : [];
  });
}

export function isWithinWorkspace(tsconfigPath: string, filePath: string): boolean {
  const workspaceRoot = findWorkspaceRoot(tsconfigPath);
  const resolvedFilePath = path.resolve(filePath);
  return isWithinDirectory(workspaceRoot, resolvedFilePath)
    && isWithinDirectory(fs.realpathSync(workspaceRoot), fs.realpathSync(resolvedFilePath));
}

export function normalizePath(filePath: string): string {
  return path.resolve(filePath).replaceAll(path.sep, '/');
}

function declaresWorkspace(directory: string): boolean {
  if (fs.existsSync(path.join(directory, 'pnpm-workspace.yaml'))) return true;
  const manifestPath = path.join(directory, 'package.json');

  if (!fs.existsSync(manifestPath)) return false;

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    return Array.isArray(manifest?.workspaces) || Array.isArray(manifest?.workspaces?.packages);
  } catch (error) {
    throw new Error(`Failed to read workspace declaration from ${manifestPath}`, { cause: error });
  }
}
