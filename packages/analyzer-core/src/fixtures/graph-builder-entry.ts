import * as fs from 'node:fs';

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

type BaseFlowContract = {
  property: () => number;
};

interface FlowContract extends BaseFlowContract {
  method(): number;
}

type ScopedMethods<Methods> = {
  [Key in keyof Methods]: Methods[Key] extends (...args: infer Params) => infer Return
    ? (...args: Params) => Return
    : Methods[Key];
};

declare const flowContract: ScopedMethods<FlowContract>;

export function interfaceFlow(): number {
  return flowContract.property() + flowContract.method();
}

export function externalNativeFlow(values: number[]): number[] {
  return values.map((value) => dependency() + value);
}

export function nativeJsApiFlow(entries: [string, number][]): Record<string, number> {
  return Object.fromEntries(entries);
}

export function nativeNodeApiFlow(): boolean {
  return fs.existsSync('/tmp');
}

export const topLevelValue = 1;
