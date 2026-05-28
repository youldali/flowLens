import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Graph } from '@flowlens/graph-model';
import Fastify from 'fastify';

export async function serveGraphViewer(graph: Graph): Promise<void> {
  const frontendDistPath = findFrontendDist();

  if (!frontendDistPath) {
    throw new Error('Could not find apps/frontend/dist. Run `pnpm --filter frontend build` before starting the graph viewer.');
  }

  const app = Fastify();

  app.get('/graph.json', async (_request, reply) => {
    return reply
      .header('cache-control', 'no-store')
      .send(graph);
  });

  app.get('/*', async (request, reply) => {
    const filePath = await findStaticFilePath(frontendDistPath, request.url);

    if (!filePath) {
      return reply.code(404).send('Not found');
    }

    return reply
      .type(getContentType(filePath))
      .send(fs.createReadStream(filePath));
  });

  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  console.log(`FlowLens graph viewer: ${address}/`);
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
