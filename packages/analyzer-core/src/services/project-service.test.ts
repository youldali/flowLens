import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ts from 'typescript';
import { findImplementationsInProjectService, type ProjectService } from './project-service.js';
import { createLanguageService } from '../mocks/language-service.js';
import { createProgram } from '../mocks/program.js';

describe('findImplementationsInProjectService', () => {
  it('builds entries for implementation locations with source files', () => {
    const text = 'export class Adapter {}';
    const source = ts.createSourceFile('/workspace/adapter.ts', text, ts.ScriptTarget.Latest);
    const start = text.indexOf('Adapter');
    const program = createProgram({
      getSourceFile: (fileName) => fileName === source.fileName ? source : undefined,
    });
    const languageService = createLanguageService({
      getImplementationAtPosition: (fileName, position) => {
        assert.equal(fileName, '/workspace/port.ts');
        assert.equal(position, 42);
        return [
          {
            fileName: source.fileName,
            textSpan: { start, length: 'Adapter'.length },
            kind: ts.ScriptElementKind.classElement,
            displayParts: [],
          },
          {
            fileName: '/workspace/missing.ts',
            textSpan: { start: 0, length: 7 },
            kind: ts.ScriptElementKind.classElement,
            displayParts: [],
          },
        ];
      },
    });
    const projectService: ProjectService = {
      projectConfig: {
        configPath: '/workspace/tsconfig.json',
        parsed: { options: {}, fileNames: [], errors: [] },
      },
      languageService,
      program,
    };

    const result = findImplementationsInProjectService(projectService, '/workspace/port.ts', 42);

    assert.deepEqual(result, [{
      name: 'Adapter',
      filePath: '/workspace/adapter.ts',
      line: 1,
      column: 14,
      offset: start,
    }]);
  });
});
