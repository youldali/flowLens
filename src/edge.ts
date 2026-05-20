import type * as NodeModule from './node.js';

export type EdgeId = string;
export type EdgeType = 'imports' | 'declares' | 'calls' | 'references'

export interface Edge {
  id: EdgeId;
  source: NodeModule.NodeId;
  target: NodeModule.NodeId;
  type: EdgeType;
}

export function create(source: NodeModule.NodeId, target: NodeModule.NodeId, type: EdgeType): Edge {
  return {
    id: `${source}->${target}:${type}`,
    source,
    target,
    type,
   }
}
    