import type { EdgeType } from '@flowlens/analyzer-core/edge'
import type { GraphNodeKind, SourceOrigin } from '@flowlens/analyzer-core/node'
import {
  useTranslation,
  type I18nKey_CODE_ANALYSIS_CONTEXT,
} from '@common/hooks/useTranslation'

const CATEGORY_KEY_BY_KIND = {
  functionDeclaration: 'graphVisualization.nodes.categories.functionDeclaration',
  methodDeclaration: 'graphVisualization.nodes.categories.methodDeclaration',
  callableTypeMemberDeclaration:
    'graphVisualization.nodes.categories.callableTypeMemberDeclaration',
  callExpression: 'graphVisualization.nodes.categories.callExpression',
  'unresolved-call-declaration': 'graphVisualization.nodes.categories.unresolvedCallDeclaration',
  file: 'graphVisualization.nodes.categories.file',
  'if-statement': 'graphVisualization.nodes.categories.ifStatement',
} satisfies Record<GraphNodeKind, I18nKey_CODE_ANALYSIS_CONTEXT>

const CATEGORY_KEY_BY_ORIGIN: Partial<
  Record<SourceOrigin, I18nKey_CODE_ANALYSIS_CONTEXT>
> = {
  external: 'graphVisualization.nodes.categories.external',
  'native-js-api': 'graphVisualization.nodes.categories.nativeJsApi',
  'native-node-api': 'graphVisualization.nodes.categories.nativeNodeApi',
}

const CLASSIFICATION_KEY_BY_ORIGIN = {
  project: 'graphVisualization.nodes.classifications.project',
  external: 'graphVisualization.nodes.classifications.external',
  'native-js-api': 'graphVisualization.nodes.classifications.nativeJsApi',
  'native-node-api': 'graphVisualization.nodes.classifications.nativeNodeApi',
  unknown: 'graphVisualization.nodes.classifications.unknown',
} satisfies Record<SourceOrigin, I18nKey_CODE_ANALYSIS_CONTEXT>

const DECLARATION_KEY_BY_KIND = {
  functionDeclaration: 'graphVisualization.nodes.declarations.functionDeclaration',
  methodDeclaration: 'graphVisualization.nodes.declarations.methodDeclaration',
  callableTypeMemberDeclaration:
    'graphVisualization.nodes.declarations.callableTypeMemberDeclaration',
  callExpression: 'graphVisualization.nodes.declarations.callExpression',
  'unresolved-call-declaration': 'graphVisualization.nodes.declarations.unresolvedCallDeclaration',
  file: 'graphVisualization.nodes.declarations.file',
  'if-statement': 'graphVisualization.nodes.declarations.ifStatement',
} satisfies Record<GraphNodeKind, I18nKey_CODE_ANALYSIS_CONTEXT>

const RELATIONSHIP_KEY_BY_TYPE = {
  imports: 'graphVisualization.nodes.relationships.imports',
  declares: 'graphVisualization.nodes.relationships.declares',
  calls: 'graphVisualization.nodes.relationships.calls',
  references: 'graphVisualization.nodes.relationships.references',
} satisfies Record<EdgeType, I18nKey_CODE_ANALYSIS_CONTEXT>

export function useNodeTranslations() {
  const { t } = useTranslation('code-analysis-context')

  return {
    category: (kind: GraphNodeKind, sourceOrigin: SourceOrigin) => t(
      CATEGORY_KEY_BY_ORIGIN[sourceOrigin] ?? CATEGORY_KEY_BY_KIND[kind],
    ),
    classification: (sourceOrigin: SourceOrigin) => t(
      CLASSIFICATION_KEY_BY_ORIGIN[sourceOrigin],
    ),
    declaration: (kind: GraphNodeKind) => t(DECLARATION_KEY_BY_KIND[kind]),
    relationship: (type: EdgeType) => t(RELATIONSHIP_KEY_BY_TYPE[type]),
  }
}
