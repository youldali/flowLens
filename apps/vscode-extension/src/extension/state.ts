export type ExtensionState = Readonly<{
  documentRevision: number;
}>;

export type ExtensionStore = ReturnType<typeof createExtensionStore>;

const initialState: ExtensionState = { documentRevision: 0 };

export function createExtensionStore() {
  let state = initialState;

  return {
    getState: () => state,
    update: (transform: (current: ExtensionState) => ExtensionState): void => {
      state = transform(state);
    },
  };
}
