import { pipe } from '@flowlens/common';

import type { AnalyzerGraph, Graph } from '../flow-graph.js';
import { removeNodes } from './remove-nodes.js';

export { removeNodes } from './remove-nodes.js';

export type GraphTransformer<TGraph extends Graph = AnalyzerGraph> = (graph: TGraph) => TGraph;

export function toReadableAnalyzerGraph(graph: AnalyzerGraph): AnalyzerGraph {
  return pipe(
    graph,
    removeNodes((node) => node.kind === 'file'),
  );
}
