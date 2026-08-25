import { pipe } from '@flowlens/common';

import type { AnalyzerGraph, FlowGraph } from '../flow-graph.js';
import { removeNodes } from './remove-nodes.js';

export { removeNodes } from './remove-nodes.js';

export type GraphTransformer<TGraph extends FlowGraph = AnalyzerGraph> = (graph: TGraph) => TGraph;

export function toReadableGraph<TGraph extends FlowGraph>(graph: TGraph): TGraph {
  return pipe(
    graph,
    removeNodes<TGraph>((node) => node.kind === 'file'),
  );
}

export function toReadableAnalyzerGraph(graph: AnalyzerGraph): AnalyzerGraph {
  return toReadableGraph(graph);
}

export function toProjectSourceGraph<TGraph extends FlowGraph>(graph: TGraph): TGraph {
  return pipe(
    graph,
    removeNodes<TGraph>((node) => node.sourceOrigin !== 'project' && node.sourceOrigin !== 'unknown'),
  );
}
