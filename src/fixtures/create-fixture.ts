export const createFixture = <T>(fixture: Partial<T>) => (overrides: Partial<T>) => {
    return {
        ...fixture,
        ...overrides
    };
}
