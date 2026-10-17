import { createFixture } from '@flowlens/test-utils';
import type { FunctionExplanation } from '#domain/function-explanation';

export const create = createFixture<FunctionExplanation>({
  purpose: 'Returns the dependency result.',
  behavior: ['Calls dependency and returns its result.'],
  sideEffects: [],
  failureCases: [],
  uncertainties: ['The dependency implementation is not supplied.'],
});
