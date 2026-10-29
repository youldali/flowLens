import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { err, ok } from 'neverthrow';
import { WorkspaceAnalysisService } from '@flowlens/analyzer-core/services/workspace-analysis-service';
import { generateGraph } from './generate-graph.js';

describe('generateGraph', () => {
  it('delivers analysis results to the matching callback and propagates exceptions', async t => {
    const graph = { nodes: [], edges: [] };
    const analysisService = new WorkspaceAnalysisService();
    const analyze = t.mock.method(analysisService, 'analyze', async () => ok(graph));
    const onSuccess = t.mock.fn(async () => {});
    const onFailure = t.mock.fn(async () => {});
    const options = { filePath: '/project/entry.ts', offset: 17, analysisService, onSuccess, onFailure };

    await generateGraph(options);
    assert.deepEqual(analyze.mock.calls[0]!.arguments, [options.filePath, options.offset]);
    assert.deepEqual(onSuccess.mock.calls[0]!.arguments, [graph]);
    assert.equal(onFailure.mock.callCount(), 0);

    const error = { reason: 'tsconfig-not-found' } as const;
    analyze.mock.mockImplementation(async () => err(error));
    await generateGraph(options);
    assert.deepEqual(onFailure.mock.calls[0]!.arguments, [error]);
    assert.equal(onSuccess.mock.callCount(), 1);

    const unexpectedError = new Error('Analysis failed');
    analyze.mock.mockImplementation(async () => { throw unexpectedError; });
    await assert.rejects(generateGraph(options), error => error === unexpectedError);

    analyze.mock.mockImplementation(async () => ok(graph));
    onSuccess.mock.mockImplementation(async () => { throw unexpectedError; });
    await assert.rejects(generateGraph(options), error => error === unexpectedError);
    assert.equal(onFailure.mock.callCount(), 1);
  });
});
