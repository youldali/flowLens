import { pipe } from '@flowlens/common';

import type { FlowGraph } from '../flow-graph.js';
import { collapseResolvedCallExpressionNodes } from './collapse-resolved-call-expression-nodes.js';
import { removeNodes } from './remove-nodes.js';

export type GraphTransformer<TGraph extends FlowGraph = FlowGraph> = (graph: TGraph) => TGraph;

export function toFlowGraph<TGraph extends FlowGraph>(graph: TGraph): TGraph {
  return pipe(
    graph,
    collapseResolvedCallExpressionNodes,
  );
}

export function toReadableGraph<TGraph extends FlowGraph>(graph: TGraph): TGraph {
  return pipe(
    graph,
    removeNodes<TGraph>((node) => node.kind === 'file'),
  );
}

export function toProjectSourceGraph<TGraph extends FlowGraph>(graph: TGraph): TGraph {
  return pipe(
    graph,
    removeNodes<TGraph>((node) => node.sourceOrigin !== 'project' && node.sourceOrigin !== 'unknown'),
  );
}
