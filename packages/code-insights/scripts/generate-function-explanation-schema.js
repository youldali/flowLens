import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { functionExplanationSchema } from '../dist/domain/function-explanation-contract.js';

// Codex's --output-schema option requires a JSON Schema file. Generate it once at
// build time from the Zod contract to avoid per-request writes and schema drift.
// Used by packages/code-insights/src/infrastructure/codex-function-explainer.ts.
// The extension build copies this file beside its bundle for runtime access.
await writeFile(
  new URL('../dist/infrastructure/function-explanation.schema.json', import.meta.url),
  `${JSON.stringify(z.toJSONSchema(functionExplanationSchema), null, 2)}\n`,
);
