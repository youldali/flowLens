import { z } from 'zod';
import type { Edge } from './edge.js';
import type { FlowGraph } from './flow-graph.js';
import type { SerializedGraphNode } from './node.js';

export type { FlowGraph, Graph } from './flow-graph.js';

const serializedGraphNodeBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  filePath: z.string(),
  sourceOrigin: z.enum(['project', 'external', 'native-js-api', 'native-node-api', 'unknown']),
});

export const serializedGraphNodeSchema = z.discriminatedUnion('kind', [
  serializedGraphNodeBaseSchema.extend({
    kind: z.literal('functionDeclaration'),
  }),
  serializedGraphNodeBaseSchema.extend({
    kind: z.literal('methodDeclaration'),
  }),
  serializedGraphNodeBaseSchema.extend({
    kind: z.literal('callExpression'),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    text: z.string(),
  }),
  serializedGraphNodeBaseSchema.extend({
    kind: z.literal('file'),
  }),
  serializedGraphNodeBaseSchema.extend({
    kind: z.literal('if-statement'),
  }),
]) satisfies z.ZodType<SerializedGraphNode>;

export const callExpressionEdgeMetadataSchema = z.object({
  kind: z.literal('call-expression'),
  callSite: z.object({
    filePath: z.string(),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    text: z.string().optional(),
  }).strict(),
}).strict();

export const edgeMetadataSchema = z.discriminatedUnion('kind', [
  callExpressionEdgeMetadataSchema,
]);

export const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.enum(['imports', 'declares', 'calls', 'references']),
  metadata: edgeMetadataSchema.optional(),
}) satisfies z.ZodType<Edge>;

export const flowGraphSchema = z.object({
  nodes: z.array(serializedGraphNodeSchema),
  edges: z.array(edgeSchema),
}) satisfies z.ZodType<FlowGraph>;

export function isFlowGraph(value: unknown): value is FlowGraph {
  return flowGraphSchema.safeParse(value).success;
}
