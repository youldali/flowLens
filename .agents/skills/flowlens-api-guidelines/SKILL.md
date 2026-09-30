---
name: flowlens-api-guidelines
description: FlowLens backend API request parsing and error response conventions. Use when creating, editing, or reviewing backend HTTP endpoints, query parameters, or API error payloads.
metadata:
  short-description: FlowLens backend API conventions
---

# FlowLens API Guidelines

## Query Payloads

- Parse and validate query payloads with Zod before using their values.
- Use the successful Zod parse result as the typed query payload.

## Backend Error Responses

- Send backend errors as JSON objects, not plain text.
- Include a `reason` property whose string value is in kebab case.
- Include an optional `error` property when additional error details are useful.

Examples:

```ts
{ reason: 'source-not-found' }
{ reason: 'invalid-request', error: queryResult.error.issues }
```
