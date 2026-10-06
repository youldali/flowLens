import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GraphAdapter } from '@flowlens/analyzer-core/graph-adapter';
import Fastify, { type FastifyReply } from 'fastify';
import { z } from 'zod';

const sourceQuerySchema = z.object({
  filePath: z.string().min(1),
  offset: z.string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().nonnegative()),
});

export async function serveGraphViewer(graphAdapter: GraphAdapter): Promise<void> {
  const frontendDistPath = findFrontendDist();

  if (!frontendDistPath) {
    throw new Error('Could not find apps/frontend/dist. Run `pnpm --filter frontend build` before starting the graph viewer.');
  }

  const app = createGraphViewerServer(graphAdapter, frontendDistPath);
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  console.log(`FlowLens graph viewer: ${address}/`);
}

export function createGraphViewerServer(graphAdapter: GraphAdapter, frontendDistPath: string) {
  const app = Fastify();

  app.get('/graph.json', async (_request, reply) => {
    return reply
      .header('cache-control', 'no-store')
      .send(graphAdapter.extract());
  });

  app.get('/source', async (request, reply) => {
    const queryResult = sourceQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.code(400).send({
        reason: 'invalid-request',
        error: queryResult.error.issues,
      });
    }

    const { filePath, offset } = queryResult.data;
    const sourceResult = graphAdapter.getNavigableSource(filePath);

    if (sourceResult.isErr()) {
      return reply.code(404).send({ reason: 'source-not-found' });
    }

    if (offset > sourceResult.value.length) {
      return reply.code(400).send({
        reason: 'invalid-offset',
        error: 'the offset is out of the file bounds',
      });
    }

    return reply
      .type('text/html; charset=utf-8')
      .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'")
      .send(renderSourcePage(filePath, sourceResult.value, offset));
  });

  app.get('/*', async (request, reply) => {
    const filePath = await findStaticFilePath(frontendDistPath, request.url);

    if (!filePath) {
      return reply.code(404).send('Not found');
    }

    return await sendStaticFile(reply, filePath);
  });

  return app;
}

/**
 * Converts a source file into a standalone HTML page that:
 * - Determines which line contains the requested character offset.
 * - Escapes the file path and source code to prevent HTML injection.
 * - Wraps every source line in a span.
 * - Highlights the line containing the offset.
 * - Gives the remaining lines numbered IDs such as L1 and L2.
 * - Includes the styling needed to display the highlighted source.
 */
function renderSourcePage(filePath: string, source: string, offset: number): string {
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const escapedSource = escapeHtml(source);
  const lines = escapedSource.split('\n').map((text, index) =>
    `<span id="${index + 1 === line ? 'selected' : 'L' + (index + 1)}"${index + 1 === line ? ' class="selected"' : ''}>${text || ' '}</span>`).join('\n');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(filePath)}</title><style>body{font:14px monospace;margin:16px;background:#171b22;color:#eee}pre{line-height:1.5}pre span{display:block}.selected{background:#38465c}</style></head><body><h1>${escapeHtml(filePath)}</h1><pre>${lines}</pre></body></html>`;
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

async function sendStaticFile(reply: FastifyReply, filePath: string): Promise<FastifyReply> {
  if (path.basename(filePath) !== 'index.html') {
    return reply
      .type(getContentType(filePath))
      .send(fs.createReadStream(filePath));
  }

  const indexHtml = await fs.promises.readFile(filePath, 'utf8');

  return reply
    .type(getContentType(filePath))
    .send(injectRuntimeHost(indexHtml));
}

function injectRuntimeHost(indexHtml: string): string {
  const script = '<script>window.__flowlensHost = "cli";</script>';

  return indexHtml.includes('</head>')
    ? indexHtml.replace('</head>', `    ${script}\n  </head>`)
    : `${script}\n${indexHtml}`;
}

function findFrontendDist(): string | undefined {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const invocationDir = process.env.INIT_CWD ?? process.cwd();
  const candidates = [
    path.resolve(invocationDir, 'apps/frontend/dist'),
    path.resolve(process.cwd(), 'apps/frontend/dist'),
    path.resolve(moduleDir, '../../frontend/dist'),
    path.resolve(moduleDir, '../../../frontend/dist'),
  ];

  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));
}

async function findStaticFilePath(
  frontendDistPath: string,
  url: string,
): Promise<string | undefined> {
  const requestPath = getRequestPath(url);
  const staticPath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.resolve(frontendDistPath, `.${staticPath}`);

  if (!filePath.startsWith(`${frontendDistPath}${path.sep}`)) {
    return undefined;
  }

  return await findReadableFile(filePath) ?? await findReadableFile(path.join(frontendDistPath, 'index.html'));
}

function getRequestPath(url: string): string {
  try {
    return decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname);
  } catch {
    return '/';
  }
}

async function findReadableFile(filePath: string): Promise<string | undefined> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile() ? filePath : undefined;
  } catch {
    return undefined;
  }
}

function getContentType(filePath: string): string {
  switch (path.extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}
