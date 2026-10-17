import { randomUUID } from 'node:crypto';
import type { FlowGraph } from '@flowlens/analyzer-core/domain/flow-graph';
import type { GraphSession } from '@flowlens/analyzer-core/domain/graph-session';

export function createGraphSession(graph: FlowGraph): GraphSession {
  return { graphId: randomUUID(), graph };
}
