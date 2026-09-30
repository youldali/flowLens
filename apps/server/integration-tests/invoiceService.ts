import type { Invoice } from './invoice.js'
import type { InvoiceRepositoryPort } from './invoiceRepositoryPort.js'

interface Dependencies {
  invoiceRepository: InvoiceRepositoryPort
}

export function readInvoice(id: string, { invoiceRepository }: Dependencies): Invoice | undefined {
  return invoiceRepository.get(id)
}
