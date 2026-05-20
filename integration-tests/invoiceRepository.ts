import type { Invoice } from './invoice.js'

export function get(id: string): Invoice | undefined {
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
