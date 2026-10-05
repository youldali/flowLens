export type PipeTransform<T> = (value: T) => T;

export function pipe<T>(value: T, ...transforms: Array<PipeTransform<T>>): T {
  return transforms.reduce((currentValue, transform) => transform(currentValue), value);
}

export function identity<T>(value: T): T {
  return value;
}
