import type { NodeId } from './node.js';

export type EdgeId = string;
export type EdgeType = 'imports' | 'declares' | 'calls' | 'references';

export interface CallExpressionEdgeMetadata {
  kind: 'call-expression';
  callSite: {
    filePath: string;
    start: number;
    end: number;
    text?: string | undefined;
  };
}

export type EdgeMetadata = CallExpressionEdgeMetadata;

export interface Edge {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  type: EdgeType;
  metadata?: EdgeMetadata | undefined;
}

export function create(source: NodeId, target: NodeId, type: EdgeType, metadata?: EdgeMetadata): Edge {
  return {
    id: createId(source, target, type, metadata),
    source,
    target,
    type,
    ...(metadata ? { metadata } : {}),
  }
}

function createId(source: NodeId, target: NodeId, type: EdgeType, metadata: EdgeMetadata | undefined): EdgeId {
  const baseId = `${source}->${target}:${type}`;

  return metadata
    ? `${baseId}:${createMetadataId(metadata)}`
    : baseId;
}

function createMetadataId(metadata: EdgeMetadata): string {
  return `${metadata.kind}:${metadata.callSite.filePath}:${metadata.callSite.start}:${metadata.callSite.end}`;
}
