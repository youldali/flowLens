import { z } from 'zod';
import type { Edge } from './edge.js';
import type { FlowGraph } from './flow-graph.js';
import type { Node } from './node.js';

export type { FlowGraph } from './flow-graph.js';

const nodeBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  filePath: z.string(),
  sourceOrigin: z.enum(['project', 'external', 'native-js-api', 'native-node-api', 'unknown']),
});

export const nodeSchema: z.ZodType<Node> = z.discriminatedUnion('kind', [
  nodeBaseSchema.extend({
    kind: z.literal('functionDeclaration'),
    jsdoc: z.string().optional(),
  }),
  nodeBaseSchema.extend({
    kind: z.literal('methodDeclaration'),
    jsdoc: z.string().optional(),
  }),
  nodeBaseSchema.extend({
    kind: z.literal('callExpression'),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    text: z.string(),
    declarationFile: z.string().optional(),
  }),
  nodeBaseSchema.extend({
    kind: z.literal('file'),
  }),
  nodeBaseSchema.extend({
    kind: z.literal('if-statement'),
  }),
]);

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
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
}) satisfies z.ZodType<FlowGraph>;

export function isFlowGraph(value: unknown): value is FlowGraph {
  return flowGraphSchema.safeParse(value).success;
}
