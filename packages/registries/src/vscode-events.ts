import { z } from 'zod';
import { err, ok, type Result } from 'neverthrow';
import { flowGraphSchema } from '@flowlens/analyzer-core/flow-graph-contract';
import { createEventSchema, type EventDefinition, type EventFromDefinition } from './event-definition.js';

export const eventRegistry = {
  flowgraph: {
    type: 'flowgraph',
    payload: z.object({
      graph: flowGraphSchema,
    }),
  },
  'view.ready': {
    type: 'view.ready',
    payload: z.object({}),
  },
} satisfies Record<string, EventDefinition<string, z.ZodType>>;

export type VsCodeEventRegistry = {
  [EventName in keyof typeof eventRegistry]: EventFromDefinition<(typeof eventRegistry)[EventName]>;
};

export type FlowGraphEvent = VsCodeEventRegistry['flowgraph'];
export type ViewReadyEvent = VsCodeEventRegistry['view.ready'];
export type ParseVsCodeEventError =
  | { kind: 'event-type-unknown'; eventType: string }
  | { kind: 'parsing-vscode-event-failed'; eventType: keyof VsCodeEventRegistry };

export const flowGraphEventSchema = createEventSchema(eventRegistry.flowgraph);
export const viewReadyEventSchema = createEventSchema(eventRegistry['view.ready']);

type VsCodeEventRegistryGuards = {
  [Type in keyof VsCodeEventRegistry]: (event: unknown) => event is VsCodeEventRegistry[Type];
};

export const vscodeEventRegistryGuards = {
  flowgraph: isFlowGraphEvent,
  'view.ready': isViewReadyEvent,
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

function isVsCodeEventType(type: string): type is keyof VsCodeEventRegistry {
  return type in vscodeEventRegistryGuards;
}
