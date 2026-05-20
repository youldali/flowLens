import { err, ok, type Result } from 'neverthrow';

export type QueueError = 'empty-queue';

export class Queue<T> {
  private readonly items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  pop(): Result<T, QueueError> {
    if (this.items.length === 0) {
      return err('empty-queue');
    }

    return ok(this.items.shift() as T);
  }

  count(): number {
    return this.items.length;
  }
}
