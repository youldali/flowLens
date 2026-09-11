import type { SourceOrigin } from '@flowlens/analyzer-core/node'

export function shouldDisplayNodeLocation(sourceOrigin: SourceOrigin): boolean {
  return sourceOrigin === 'project' || sourceOrigin === 'unknown'
}
