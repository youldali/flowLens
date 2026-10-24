import type { Node } from 'typescript-native/ast';
import type { Checker, Signature, Symbol } from 'typescript-native/async';

export const createTypeChecker = (overrides: Omit<Partial<Checker>, 'getSymbolAtLocation'> & { getSymbolAtLocation?: (node: Node) => Promise<Symbol | undefined> } = {}): Checker => ({
  getResolvedSignature: async () => ({} as Signature),
  isUnknownSignature: async (signature: Signature) => !signature.declaration,
  getSymbolAtLocation: async () => undefined,
  ...overrides,
} as Checker);
