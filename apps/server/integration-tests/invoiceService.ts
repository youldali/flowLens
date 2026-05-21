import type { Invoice } from './invoice.js'
import { get } from './invoiceRepository.js'

export function readInvoice(id: string): Invoice | undefined {
  return get(id)
}
