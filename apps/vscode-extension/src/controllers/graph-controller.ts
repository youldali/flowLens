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
import { ResultFlow } from '@youldali/result-flow';
import { createGraphSession } from '@services/graph-session.js';

type ExplainFunction = (node: FunctionDeclarationNode) => ResultFlow<FunctionExplanation, AiApiError>;
export type GraphControllerDependencies = { explainFunction?: ExplainFunction };
export type GraphEvent = ExplainNodeEvent;
export type GraphEventResult = ExplainNodeResultEvent | ExplainNodeErrorEvent;
type NodeRequest = { graphId: GraphId; nodeId: string };
type NodeResolutionError = 'stale-graph' | 'node-not-found';
type ExplanationError = { reason: 'node-not-explainable' | AiApiError['reason']; statusCode?: number | undefined; cause?: unknown };

export class GraphController {
  readonly session: GraphSession;

  constructor(graph: FlowGraph, private readonly dependencies: GraphControllerDependencies = {}) {
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
    const dependencies = this.dependencies;
    return ResultFlow.gen<FunctionExplanation, ExplanationError>(async function* () {
      // Preconditions validate both values before this body runs.
      return yield* dependencies.explainFunction!(node as FunctionDeclarationNode);
    }).precondition<ExplanationError>(
      () => !!dependencies.explainFunction,
      () => ({ reason: 'missing-api-token' } as const),
    ).precondition<ExplanationError>(
      () => isFunctionDeclarationNode(node),
      () => ({ reason: 'node-not-explainable' } as const),
    ).catch(cause => err<never, ExplanationError>({
      reason: 'generation-failed' as const,
      cause: Object.assign(new Error('Could not generate a function explanation.', { cause }), { request }),
    })).runAndMatch<GraphEventResult>({
      ok: explanation => createVsCodeEvent('explain.node.result', { ...request.payload, explanation }),
      err: error => {
        console.error('FlowLens: Could not explain node.', {
          ...request.payload,
          reason: error.reason,
          cause: error.cause,
        });

        return createVsCodeEvent('explain.node.error', {
          ...request.payload, reason: error.reason,
          ...(error.statusCode !== undefined ? { statusCode: error.statusCode } : {}),
        });
      },
    });
  }
}

function isGraphEvent(message: unknown): message is GraphEvent {
  return isExplainNodeEvent(message);
}
