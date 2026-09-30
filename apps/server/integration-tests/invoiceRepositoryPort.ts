import type { Invoice } from './invoice.js'

export interface InvoiceRepositoryPort {
  get(id: string): Invoice | undefined
}
