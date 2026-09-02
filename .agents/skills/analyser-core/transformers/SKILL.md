---
name: transformers
description: FlowLens analyser-core graph-transformer architecture and GraphAdapter invariants. Use when creating, modifying, or reviewing transformers in packages/analyzer-core/src/transformer or their frontend presets.
---

# Analyser-Core Graph Transformers

## Input invariant

All `FlowGraph` values passed to transformers originate from `GraphAdapter.extract()`, possibly after serialization and deserialization.

Transformers may rely on these `GraphAdapter` guarantees:

- Node IDs identify static TypeScript AST locations and are unique.
- Each call-expression node represents one static call site.
- Reference edges from call expressions are created only for executable declarations added by `GraphAdapter`.
- Nested call expressions are valid and may produce call-expression-to-call-expression `calls` edges.

Do not add validation, deduplication, `Result` errors, or fallback behavior for arbitrary externally constructed graphs unless the graph input boundary is explicitly changed.

## Transformer responsibilities

Keep enrichment and collapsing separate:

- Enrichment transformers add semantic nodes and edges without replacing existing nodes.
- Collapse transformers own node removal, edge bridging, and call-site metadata propagation.

Test behavior using `GraphAdapter`-valid topology, including nested calls when call-expression connectivity is affected.
