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
  return findGitRoot(projectDirectory) ?? projectDirectory;
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

export function findGitRoot(directory: string): string | undefined {
  if (fs.existsSync(path.join(directory, '.git'))) return directory;
  const parent = path.dirname(directory);
  return parent === directory ? undefined : findGitRoot(parent);
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
