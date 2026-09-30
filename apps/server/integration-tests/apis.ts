import type { FastifyInstance } from 'fastify'
import { InvoiceRepository } from './invoiceRepository.js'
import { readInvoice } from './invoiceService.js'

interface InvoiceRouteParams {
  id: string
}

const invoiceRepository = new InvoiceRepository()

export async function registerApis(fastify: FastifyInstance) {
  fastify.get<{ Params: InvoiceRouteParams }>('/invoices/:id', async (request, reply) => {
    const invoice = readInvoice(request.params.id, { invoiceRepository })

    if (!invoice) {
      return reply.code(404).send({ message: 'Invoice not found' })
    }

    return invoice
  })
}
