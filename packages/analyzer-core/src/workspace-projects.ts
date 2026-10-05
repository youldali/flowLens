import * as path from 'node:path';
import * as ts from 'typescript';
import { excludedDirectories, findTsConfigPaths, isWithinDirectory } from '@flowlens/common/fs';
import { sortAlphabetically } from '@flowlens/common/sorting';
import { loadProjectConfig, type ProjectConfig } from './project-config.js';

export function discoverWorkspaceProjects(root: string): ProjectConfig[] {
  const configs: ProjectConfig[] = [];
  const visited = new Set<string>();
  const outputDirectories = new Set<string>();
  const isWithinOutputDirectory = (configPath: string): boolean =>
    [...outputDirectories].some(output => isWithinDirectory(output, configPath));
  const candidates = findTsConfigPaths(root);

  for (const candidate of candidates) {
    const configPath = path.resolve(candidate);
    if (visited.has(configPath) || !isWithinDirectory(root, configPath)) continue;
    visited.add(configPath);
    if (isWithinOutputDirectory(configPath)) continue;

    try {
      const config = loadProjectConfig(configPath);
      configs.push(config);
      getOutputDirectories(config).forEach(output => outputDirectories.add(output));
      candidates.push(...getReferencePaths(root, config));
    } catch (error) {
      throw new Error(`Failed to discover workspace project ${configPath}`, { cause: error });
    }
  }

  return configs
    .filter(config => !isWithinOutputDirectory(config.configPath))
    .sort(sortAlphabetically(config => config.configPath));
}

function getOutputDirectories(config: ProjectConfig): string[] {
  return [config.parsed.options.outDir, config.parsed.options.declarationDir]
    .filter((output): output is string => Boolean(output))
    .map(output => path.resolve(output));
}

function getReferencePaths(root: string, config: ProjectConfig): string[] {
  return (config.parsed.projectReferences ?? [])
    .map(reference => ts.resolveProjectReferencePath(reference))
    .filter(referencePath => !path.relative(root, referencePath).split(path.sep).some(part => excludedDirectories.has(part)));
}
