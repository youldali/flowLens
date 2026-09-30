import ts from 'typescript';

export const createLanguageService = (
  overrides: Partial<ts.LanguageService> = {},
): ts.LanguageService => {
  return {
    getImplementationAtPosition: () => undefined,
    ...overrides,
  } as unknown as ts.LanguageService;
};
