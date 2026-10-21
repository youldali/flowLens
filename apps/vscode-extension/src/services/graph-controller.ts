import { findNodeInGraphById, type FlowGraph } from '@flowlens/analyzer-core/domain/flow-graph';
import type { GraphId, GraphSession } from '@flowlens/analyzer-core/domain/graph-session';
import { isFunctionDeclarationNode, type Node, type FunctionDeclarationNode } from '@flowlens/analyzer-core/domain/node';
import type { FunctionExplanation } from '@flowlens/code-insights/domain/function-explanation-contract';
import type { AiApiError } from '@flowlens/code-insights';
import {
  createVsCodeEvent,
  isExplainNodeEvent,
  type ExplainNodeEvent,
  type ExplainNodeResultEvent,
  type ExplainNodeErrorEvent,
} from '@flowlens/registries/vscode-events';
import { err, ok, type Result } from 'neverthrow';
import { createGraphSession } from './graph-session.js';

type ExplainFunction = (node: FunctionDeclarationNode) => Promise<Result<FunctionExplanation, AiApiError>>;
export type GraphControllerOptions = { explainFunction?: ExplainFunction };
export type GraphEvent = ExplainNodeEvent;
export type GraphEventResult = ExplainNodeResultEvent | ExplainNodeErrorEvent;
type NodeRequest = { graphId: GraphId; nodeId: string };
type NodeResolutionError = 'stale-graph' | 'node-not-found';
type ExplanationError = { reason: 'node-not-explainable' | AiApiError['reason'] };

export class GraphController {
  readonly session: GraphSession;

  constructor(graph: FlowGraph, private readonly options: GraphControllerOptions = {}) {
    this.session = createGraphSession(graph);
  }

  async handleEvent(message: unknown): Promise<GraphEventResult | undefined> {
    if (!isGraphEvent(message)) return;
    const nodeResult = this.resolveNode(message.payload);

    return nodeResult.isErr()
      ? createVsCodeEvent('explain.node.error', { ...message.payload, reason: nodeResult.error })
      : this.explainNode(nodeResult.value, message);
  }

  private resolveNode({ graphId, nodeId }: NodeRequest): Result<Node, NodeResolutionError> {
    if (this.session.graphId !== graphId) return err('stale-graph');
    const node = findNodeInGraphById(this.session.graph, nodeId);

    return node ? ok(node) : err('node-not-found');
  }

  private async explainNode(node: Node, request: ExplainNodeEvent): Promise<GraphEventResult> {
    let result: Result<FunctionExplanation, ExplanationError>;
    //!! use ResultFlow
    if (!isFunctionDeclarationNode(node)) {
      result = err({ reason: 'node-not-explainable' });
    } else if (!this.options.explainFunction) {
      result = err({ reason: 'missing-api-token' });
    } else {
      result = await this.options.explainFunction(node);
    }

    return result.match(
      explanation => createVsCodeEvent('explain.node.result', { ...request.payload, explanation }),
      error => {
        console.error('FlowLens: Could not explain node.', {
          ...request.payload,
          reason: error.reason,
        });

        return createVsCodeEvent('explain.node.error', { ...request.payload, reason: error.reason });
      },
    );
  }
}

function isGraphEvent(message: unknown): message is GraphEvent {
  return isExplainNodeEvent(message);
}
