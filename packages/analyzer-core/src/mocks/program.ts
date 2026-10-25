import type { Program as NativeProgram, Project } from 'typescript-native/async';

export const createNativeProgram = (overrides: Partial<NativeProgram> = {}): NativeProgram => ({
  isSourceFileDefaultLibrary: async () => false,
  getProject: () => ({} as Project),
  ...overrides,
} as NativeProgram);
