import { z } from 'zod';
import { functionExplanationSchema } from '@flowlens/code-insights/domain/function-explanation-contract';
import { err, ok, type Result } from 'neverthrow';
import { flowGraphSchema } from '@flowlens/analyzer-core/domain/flow-graph-contract';
import { createEventSchema, type EventDefinition, type EventFromDefinition } from './event-definition.js';

const explanationRequestSchema = z.object({
  graphId: z.string().min(1),
  nodeId: z.string().min(1),
  requestId: z.string().min(1),
});

export const eventRegistry = {
  'explain.node': { type: 'explain.node', payload: explanationRequestSchema },
  'explain.node.result': {
    type: 'explain.node.result',
    payload: explanationRequestSchema.extend({ explanation: functionExplanationSchema }),
  },
  'explain.node.error': {
    type: 'explain.node.error',
    payload: explanationRequestSchema.extend({
      reason: z.enum(['graph-unavailable', 'stale-graph', 'node-not-found', 'node-not-explainable', 'missing-api-token', 'generation-failed']),
    }),
  },
  flowgraph: {
    type: 'flowgraph',
    payload: z.object({
      graphId: z.string().min(1),
      graph: flowGraphSchema,
    }),
  },
  'view.ready': {
    type: 'view.ready',
    payload: z.object({}),
  },
  'open.source': {
    type: 'open.source',
    payload: z.object({
      filePath: z.string().min(1),
      offset: z.number().int().nonnegative(),
    }),
  },
} satisfies Record<string, EventDefinition<string, z.ZodType>>;

export type VsCodeEventRegistry = {
  [EventName in keyof typeof eventRegistry]: EventFromDefinition<(typeof eventRegistry)[EventName]>;
};

export type ExplainNodeEvent = VsCodeEventRegistry['explain.node'];
export type ExplainNodeResultEvent = VsCodeEventRegistry['explain.node.result'];
export type ExplainNodeErrorEvent = VsCodeEventRegistry['explain.node.error'];
export type FlowGraphEvent = VsCodeEventRegistry['flowgraph'];
export type ViewReadyEvent = VsCodeEventRegistry['view.ready'];
export type OpenSourceEvent = VsCodeEventRegistry['open.source'];
export type ParseVsCodeEventError =
  | { kind: 'event-type-unknown'; eventType: string }
  | { kind: 'parsing-vscode-event-failed'; eventType: keyof VsCodeEventRegistry };

export const explainNodeEventSchema = createEventSchema(eventRegistry['explain.node']);
export const explainNodeResultEventSchema = createEventSchema(eventRegistry['explain.node.result']);
export const explainNodeErrorEventSchema = createEventSchema(eventRegistry['explain.node.error']);
export const flowGraphEventSchema = createEventSchema(eventRegistry.flowgraph);
export const viewReadyEventSchema = createEventSchema(eventRegistry['view.ready']);
export const openSourceEventSchema = createEventSchema(eventRegistry['open.source']);

type VsCodeEventRegistryGuards = {
  [Type in keyof VsCodeEventRegistry]: (event: unknown) => event is VsCodeEventRegistry[Type];
};

export const vscodeEventRegistryGuards = {
  'explain.node': isExplainNodeEvent,
  'explain.node.result': isExplainNodeResultEvent,
  'explain.node.error': isExplainNodeErrorEvent,
  flowgraph: isFlowGraphEvent,
  'view.ready': isViewReadyEvent,
  'open.source': isOpenSourceEvent,
} satisfies VsCodeEventRegistryGuards;

export function createVsCodeEvent<Type extends keyof VsCodeEventRegistry>(
  type: Type,
  payload: VsCodeEventRegistry[Type]['payload'],
): VsCodeEventRegistry[Type] {
  return {
    type: eventRegistry[type].type,
    payload,
  } as VsCodeEventRegistry[Type];
}

export function parseVsCodeEvent<Type extends keyof VsCodeEventRegistry>(
  event: unknown,
  type: Type,
): Result<VsCodeEventRegistry[Type], ParseVsCodeEventError>;
export function parseVsCodeEvent(
  event: unknown,
  type: string,
): Result<VsCodeEventRegistry[keyof VsCodeEventRegistry], ParseVsCodeEventError>;
export function parseVsCodeEvent(
  event: unknown,
  type: string,
): Result<VsCodeEventRegistry[keyof VsCodeEventRegistry], ParseVsCodeEventError> {
  if (!isVsCodeEventType(type)) {
    return err({ kind: 'event-type-unknown', eventType: type });
  }

  const isEvent = vscodeEventRegistryGuards[type];

  return isEvent(event)
    ? ok(event as VsCodeEventRegistry[typeof type])
    : err({ kind: 'parsing-vscode-event-failed', eventType: type });
}

export function isFlowGraphEvent(event: unknown): event is FlowGraphEvent {
  return flowGraphEventSchema.safeParse(event).success;
}

export function isViewReadyEvent(event: unknown): event is ViewReadyEvent {
  return viewReadyEventSchema.safeParse(event).success;
}

export function isOpenSourceEvent(event: unknown): event is OpenSourceEvent {
  return openSourceEventSchema.safeParse(event).success;
}

export function isExplainNodeEvent(event: unknown): event is ExplainNodeEvent {
  return explainNodeEventSchema.safeParse(event).success;
}

export function isExplainNodeResultEvent(event: unknown): event is ExplainNodeResultEvent {
  return explainNodeResultEventSchema.safeParse(event).success;
}

export function isExplainNodeErrorEvent(event: unknown): event is ExplainNodeErrorEvent {
  return explainNodeErrorEventSchema.safeParse(event).success;
}

function isVsCodeEventType(type: string): type is keyof VsCodeEventRegistry {
  return type in vscodeEventRegistryGuards;
}
