import type { CustomerRepository, PlainCustomerRepository } from '@fixture/core/ports.js';

export class CustomerRepositoryAdapter implements CustomerRepository {
  list(): string[] {
    return ['mapped customer'];
  }

  save(value: string): void {
    value.trim();
  }
}

export class PlainCustomerRepositoryAdapter implements PlainCustomerRepository {
  list(): string[] {
    return ['plain customer'];
  }
}
