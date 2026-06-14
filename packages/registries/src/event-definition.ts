import { z } from 'zod';

export type EventDefinition<Type extends string, PayloadSchema extends z.ZodType> = {
  type: Type;
  payload: PayloadSchema;
};

export type EventFromDefinition<Definition extends EventDefinition<string, z.ZodType>> = {
  type: Definition['type'];
  payload: z.infer<Definition['payload']>;
};

export function createEventSchema<Definition extends EventDefinition<string, z.ZodType>>(
  definition: Definition,
): z.ZodType<EventFromDefinition<Definition>> {
  return z.object({
    type: z.literal(definition.type),
    payload: definition.payload,
  }) as z.ZodType<EventFromDefinition<Definition>>;
}
