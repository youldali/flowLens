import ts from 'typescript';

export const createTypeChecker = (overrides: Partial<ts.TypeChecker> = {}): ts.TypeChecker => {
  return {
    getResolvedSignature: () => undefined,
    getSignaturesOfType: () => [],
    getSymbolAtLocation: () => undefined,
    getTypeOfSymbolAtLocation: () => ({} as ts.Type),
    ...overrides,
  } as ts.TypeChecker;
};
