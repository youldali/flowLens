import ts from 'typescript';

export const createProgram = (overrides: Partial<ts.Program> = {}): ts.Program => {
  return {
    isSourceFileDefaultLibrary: () => false,
    ...overrides,
  } as ts.Program;
};
