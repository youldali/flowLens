export type GraphNodeKind =
  | 'functionDeclaration'
  | 'methodDeclaration'
  | 'callExpression'
  | 'file'
  | 'if-statement';

export type NodeId = string;
export type EdgeId = string;
export type EdgeType = 'imports' | 'declares' | 'calls' | 'references';

export interface GraphNode {
  id: NodeId;
  kind: GraphNodeKind;
  name: string;
  filePath: string;
}

export interface Edge {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  type: EdgeType;
}

export interface Graph<TNode = GraphNode, TEdge = Edge> {
  nodes: TNode[];
  edges: TEdge[];
}
