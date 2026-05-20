import * as ts from 'typescript';
import * as path from 'node:path';

export interface ProjectConfig {
  configPath: string;
  parsed: ts.ParsedCommandLine;
}

export function loadProjectConfig(tsconfigPath: string): ProjectConfig {
  const configPath = ts.findConfigFile(
    path.resolve(tsconfigPath),
    ts.sys.fileExists,
    path.basename(tsconfigPath),
  )

  if (!configPath) {
    throw new Error(`Could not find tsconfig at or above ${tsconfigPath}`)
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'))
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  )

  if (parsed.errors.length > 0) {
    const message = parsed.errors
      .map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
      .join('\n')

    throw new Error(message)
  }

  return {
    configPath,
    parsed,
  }
}
