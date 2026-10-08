import * as ts from 'typescript';
import * as path from 'node:path';

export type ConfigPath = string;

export interface ProjectConfig {
  configPath: ConfigPath;
  parsed: ts.ParsedCommandLine;
}

export function loadProjectConfig(tsconfigPath: string): ProjectConfig {
  const configPath = path.resolve(tsconfigPath);

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'))
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  )

  // Shared configs can have no source inputs when loaded independently (TS18003).
  const errors = parsed.errors.filter(error => error.code !== 18003);

  if (errors.length > 0) {
    const message = errors
      .map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
      .join('\n')

    throw new Error(message)
  }

  return {
    configPath,
    parsed,
  }
}
