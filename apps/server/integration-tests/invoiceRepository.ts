import type { Invoice } from './invoice.js'
import type { InvoiceRepositoryPort } from './invoiceRepositoryPort.js'

export class InvoiceRepository implements InvoiceRepositoryPort {
  get(id: string): Invoice | undefined {
    if (!id) {
      return undefined
    }

    return {
      id,
      date: new Date().toISOString(),
      amount: 100,
      invoiceNumber: `INV-${id}`
    }
  }
}
