import { pipe } from '@flowlens/common';

import type { FlowGraph } from '../flow-graph.js';
import { collapseResolvedCallExpressionNodes } from './collapse-resolved-call-expression-nodes.js';
import { createSyntheticNodesForCallExpressionsWithoutDeclarations } from './create-synthetic-nodes-for-call-expressions-without-declarations.js';
import { removeNodes } from './remove-nodes.js';

export {
  createSyntheticNodesForCallExpressionsWithoutDeclarations,
} from './create-synthetic-nodes-for-call-expressions-without-declarations.js';

export type GraphTransformer = (graph: FlowGraph) => FlowGraph;

export function toFlowGraph(graph: FlowGraph): FlowGraph {
  return pipe(
    graph,
    createSyntheticNodesForCallExpressionsWithoutDeclarations,
    collapseResolvedCallExpressionNodes,
  );
}

export function toReadableGraph(graph: FlowGraph): FlowGraph {
  return pipe(
    graph,
    removeNodes((node) => node.kind === 'file'),
  );
}

export function toProjectSourceGraph(graph: FlowGraph): FlowGraph {
  return pipe(
    graph,
    removeNodes((node) => node.sourceOrigin !== 'project' && node.sourceOrigin !== 'unknown'),
  );
}
