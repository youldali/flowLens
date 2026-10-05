export interface PlainCustomerRepository {
  list(): string[];
}

type Reads<T> = {
  list(): T[];
};

type Writes<T> = {
  save(value: T): void;
};

export type ScopedReads<T> = { [K in keyof Reads<T>]: Reads<T>[K] };
export type ScopedWrites<T> = { [K in keyof Writes<T>]: Writes<T>[K] };
export type CustomerRepository = ScopedReads<string> & ScopedWrites<string>;
