export const createFixture = <T>(fixture: T) => (overrides: Partial<T> = {}): T => {
    return {
        ...fixture,
        ...overrides
    };
}
