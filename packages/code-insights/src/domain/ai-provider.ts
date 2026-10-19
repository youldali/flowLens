import { z } from 'zod';

export const aiProviderSchema = z.enum(['openai', 'anthropic']);

export type AIProvider = z.infer<typeof aiProviderSchema>;
