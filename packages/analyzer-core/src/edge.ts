import type { Edge, EdgeId, EdgeType, NodeId } from '@flowlens/graph-model';
export type { Edge, EdgeId, EdgeType } from '@flowlens/graph-model';

export function create(source: NodeId, target: NodeId, type: EdgeType): Edge {
  return {
    id: `${source}->${target}:${type}`,
    source,
    target,
    type,
   }
}
    
