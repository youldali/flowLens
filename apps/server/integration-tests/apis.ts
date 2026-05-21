import type { FastifyInstance } from 'fastify'
import { readInvoice } from './invoiceService.js'

interface InvoiceRouteParams {
  id: string
}

export async function registerApis(fastify: FastifyInstance) {
  fastify.get<{ Params: InvoiceRouteParams }>('/invoices/:id', async (request, reply) => {
    const invoice = readInvoice(request.params.id)

    if (!invoice) {
      return reply.code(404).send({ message: 'Invoice not found' })
    }

    return invoice
  })
}
