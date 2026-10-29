import * as fs from 'node:fs';
import * as path from 'node:path';
import { err, ok, type Result } from 'neverthrow';
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';

export type FilePath = string;

const tsconfigFileNamePattern = /^tsconfig(?:\..+)?\.json$/;

export const excludedDirectories: ReadonlySet<string> = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.turbo', '.yarn', '.pnpm', '.cache']);

export function isWithinDirectory(directory: FilePath, filePath: FilePath): boolean {
  const relative = path.relative(directory, filePath);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function findWorkspaceRoot(filePath: FilePath): FilePath {
  const sourceDirectory = path.dirname(path.resolve(filePath));
  let directory = sourceDirectory;
  let configDirectory: FilePath | undefined;

  while (true) {
    if (declaresWorkspace(directory) || fs.existsSync(path.join(directory, '.git'))) return directory;
    if (!configDirectory && fs.existsSync(directory) && fs.readdirSync(directory, { withFileTypes: true })
      .some(entry => entry.isFile() && tsconfigFileNamePattern.test(entry.name))) configDirectory = directory;
    const parent = path.dirname(directory);

    if (parent === directory) return configDirectory ?? sourceDirectory;
    directory = parent;
  }
}

export function findNearestTsconfig(startDir: FilePath): Result<FilePath, "not-found"> {
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

export function findTsConfigFiles(directory: FilePath): FilePath[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory() && !excludedDirectories.has(entry.name)) return findTsConfigFiles(filePath);
    return entry.isFile() && tsconfigFileNamePattern.test(entry.name) ? [filePath] : [];
  });
}

/** Returns absolute config paths for direct references, without traversing them or resolving extends. */
export function findTsConfigReferences(tsconfigPath: FilePath): FilePath[] {
  const configPath = path.resolve(tsconfigPath);

  try {
    const parseErrors: ParseError[] = [];
    const config: unknown = parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''), parseErrors, { allowTrailingComma: true });
    if (parseErrors.length) {
      throw new SyntaxError(parseErrors.map(error => `${printParseErrorCode(error.error)} at offset ${error.offset}`).join(', '));
    }
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Expected a configuration object');
    if (!('references' in config)) return [];
    if (!Array.isArray(config.references)) throw new Error('Expected references to be an array');

    return config.references.map((reference: unknown) => {
      if (!reference || typeof reference !== 'object' || !('path' in reference) || typeof reference.path !== 'string') {
        throw new Error('Expected each reference to have a string path');
      }
      const referencePath = path.resolve(path.dirname(configPath), reference.path);
      return fs.statSync(referencePath).isDirectory() ? path.join(referencePath, 'tsconfig.json') : referencePath;
    });
  } catch (error) {
    throw new Error(`Failed to find TypeScript config references in ${configPath}`, { cause: error });
  }
}

/** Finds workspace configs and their transitive references, excluding paths outside the workspace. */
export function collectWorkspaceTsConfigs(root: FilePath): FilePath[] {
  const workspaceRoot = path.resolve(root);
  const candidatePaths = findTsConfigFiles(workspaceRoot);
  const configPaths = new Set<FilePath>();

  for (const candidatePath of candidatePaths) {
    const configPath = path.resolve(candidatePath);
    if (configPaths.has(configPath) || !isWithinDirectory(workspaceRoot, configPath)) continue;
    if (path.relative(workspaceRoot, path.dirname(configPath)).split(path.sep).some(directory => excludedDirectories.has(directory))) continue;
    configPaths.add(configPath);
    candidatePaths.push(...findTsConfigReferences(configPath));
  }

  return [...configPaths];
}

export function isWithinWorkspace(tsconfigPath: FilePath, filePath: FilePath): boolean {
  const workspaceRoot = findWorkspaceRoot(tsconfigPath);
  const resolvedFilePath = path.resolve(filePath);
  return isWithinDirectory(workspaceRoot, resolvedFilePath)
    && isWithinDirectory(fs.realpathSync(workspaceRoot), fs.realpathSync(resolvedFilePath));
}

export function normalizePath(filePath: FilePath): FilePath {
  return path.resolve(filePath).replaceAll(path.sep, '/');
}

function declaresWorkspace(directory: FilePath): boolean {
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
