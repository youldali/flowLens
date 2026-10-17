import type { FlowGraph } from './flow-graph.js';

export type GraphId = string;

export interface GraphSession {
  graphId: GraphId;
  graph: FlowGraph;
}
