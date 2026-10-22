import type { ExplanationErrorReason } from '../../../apis/useExplainNodeQuery'
export type ExplanationRecoveryAction = 'configure-ai-provider' | 'generate-graph' | 'retry'
export type ExplanationSeverity = 'info' | 'warning' | 'error'
export interface ExplanationErrorPresentation {
  severity: ExplanationSeverity
  title: `explanation.errors.${Exclude<ExplanationErrorReason, 'cancelled'>}` | 'explanation.configured'
  description: `explanation.descriptions.${Exclude<ExplanationErrorReason, 'cancelled'>}`
    | `explanation.providerDetails.${'authentication' | 'permissions' | 'rateLimit' | 'unavailable'}`
    | 'explanation.configuredDescription' | 'explanation.configurationFailed' | 'explanation.graphDeliveryFailed'
  action?: ExplanationRecoveryAction
}

const presentations = {
  'missing-api-token': { severity: 'info', action: 'configure-ai-provider' },
  'graph-unavailable': { severity: 'warning', action: 'generate-graph' },
  'stale-graph': { severity: 'warning' },
  'node-not-found': { severity: 'warning' },
  'node-not-explainable': { severity: 'info' },
  'api-error': { severity: 'error', action: 'retry' },
  'invalid-output': { severity: 'error', action: 'retry' },
  'generation-failed': { severity: 'error', action: 'retry' },
  'delivery-failed': { severity: 'error', action: 'retry' },
  cancelled: null,
} satisfies Record<ExplanationErrorReason, { severity: ExplanationSeverity; action?: ExplanationRecoveryAction } | null>

export function getExplanationErrorPresentation(
  reason: ExplanationErrorReason,
  statusCode?: number,
  recovery: { configured?: boolean; configurationFailed?: boolean; generationFailed?: boolean } = {},
): ExplanationErrorPresentation | null {
  if (reason === 'cancelled') return null
  if (reason === 'missing-api-token' && recovery.configured) {
    return { severity: 'info', title: 'explanation.configured', description: 'explanation.configuredDescription', action: 'retry' }
  }

  const presentation = presentations[reason]
  const detail = reason === 'api-error' ? getProviderDetail(statusCode) : undefined

  return {
    ...presentation,
    title: `explanation.errors.${reason}`,
    description: recovery.configurationFailed ? 'explanation.configurationFailed'
      : recovery.generationFailed ? 'explanation.graphDeliveryFailed'
        : detail ? `explanation.providerDetails.${detail}` : `explanation.descriptions.${reason}`,
  }
}

function getProviderDetail(statusCode?: number) {
  if (statusCode === 401) return 'authentication'
  if (statusCode === 403) return 'permissions'
  if (statusCode === 429) return 'rateLimit'
  if (statusCode !== undefined && statusCode >= 500 && statusCode <= 599) return 'unavailable'
}
