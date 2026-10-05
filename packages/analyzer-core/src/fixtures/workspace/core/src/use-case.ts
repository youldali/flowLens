import type { CustomerRepository, PlainCustomerRepository } from './ports.js';

export class CreateCustomerUseCase {
  constructor(private readonly deps: {
    customerRepository: CustomerRepository;
    plainRepository: PlainCustomerRepository;
  }) {}

  execute(): void {
    this.deps.customerRepository.list();
    this.deps.plainRepository.list();
  }
}
