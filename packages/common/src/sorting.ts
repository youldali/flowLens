export function sortAlphabetically<T>(select: (value: T) => string): (a: T, b: T) => number {
  return (a, b) => select(a).localeCompare(select(b));
}
