import { z } from 'zod';
import type { Edge } from './edge.js';
import type { FlowGraph } from './flow-graph.js';
import type { GraphNode } from './node.js';

export type { FlowGraph, Graph } from './flow-graph.js';

export const graphNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(['functionDeclaration', 'methodDeclaration', 'callExpression', 'file', 'if-statement']),
  name: z.string(),
  filePath: z.string(),
}) satisfies z.ZodType<GraphNode>;

export const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.enum(['imports', 'declares', 'calls', 'references']),
}) satisfies z.ZodType<Edge>;

export const flowGraphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(edgeSchema),
}) satisfies z.ZodType<FlowGraph>;

export function isFlowGraph(value: unknown): value is FlowGraph {
  return flowGraphSchema.safeParse(value).success;
}
