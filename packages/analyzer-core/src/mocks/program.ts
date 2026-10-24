import type { Program as NativeProgram, Project } from 'typescript-native/async';
import ts from 'typescript';

export const createProgram = (overrides: Partial<ts.Program> = {}): ts.Program => {
  return {
    isSourceFileDefaultLibrary: () => false,
    ...overrides,
  } as ts.Program;
};


export const createNativeProgram = (overrides: Partial<NativeProgram> = {}): NativeProgram => ({
  isSourceFileDefaultLibrary: async () => false,
  getProject: () => ({} as Project),
  ...overrides,
} as NativeProgram);
