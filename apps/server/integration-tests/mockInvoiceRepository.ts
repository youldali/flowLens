import type { Invoice } from './invoice.js'
import type { InvoiceRepositoryPort } from './invoiceRepositoryPort.js'

export class MockInvoiceRepository implements InvoiceRepositoryPort {
  constructor(private readonly invoices: Invoice[] = []) {}

  get(id: string): Invoice | undefined {
    return this.invoices.find((invoice) => invoice.id === id)
  }
}
