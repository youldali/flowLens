export function selectedFlow(): number {
  const value = dependency();
  return value;
}

export function otherFlow(): number {
  return dependency();
}

export function dependency(): number {
  return 1;
}

export const topLevelValue = 1;
