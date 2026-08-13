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

export class FlowService {
  run(): number {
    const value = dependency();
    return value;
  }
}

export function externalNativeFlow(values: number[]): number[] {
  return values.map((value) => dependency() + value);
}

export const topLevelValue = 1;
