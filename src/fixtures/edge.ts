import type { Edge } from '../edge.js';
import { createFixture } from './create-fixture.js';

const edgeFixture: Edge = {
  id: "source-node->target-node:calls",
  source: "source-node",
  target: "target-node",
  type: "calls",
};

export const create = createFixture<Edge>(edgeFixture);
