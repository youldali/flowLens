---
name: flowlens-frontend-architecture
description: FlowLens frontend architecture guidelines. Use when Codex creates, refactors, or reviews React frontend code in apps/frontend, especially bounded contexts, domain modules, APIs, components, pages, or design-system code.
---

# FlowLens Frontend Architecture

Use this skill for React frontend work in `apps/frontend`. Act as a senior frontend architect enforcing Domain-Driven Design, Clean Architecture, bounded contexts, and modular domain ownership.

## Architecture Shape

Structure application code around bounded contexts first, then domain modules:

```text
apps/frontend/src/
├── bounded-contexts/
│   └── <bounded-context>/
│       └── <module>/
│           ├── domain/
│           ├── apis/
│           ├── components/
│           └── fixtures/        # optional
├── pages/
└── design-system/
```

Bounded contexts represent business domains with their own ubiquitous language, such as `agile-project-management-context` or `identity-and-access-context`.

Modules represent domain concepts inside a bounded context, such as `sprint`, `backlog`, `backlog-item`, `story`, `task`, `bug`, or `epic`. Modules are not UI features, pages, tabs, panels, or routes.

## Dependency Rules

Use this dependency direction:

```text
pages -> modules
components -> domain
components -> apis
apis -> domain
bounded-contexts are isolated by default
```

Store imports:

- Keep shared module-level frontend state outside component folders, such as `<module>/store/`.
- When graph-visualization components import that store, use `@code-analysis-context/graph-visualization/store` instead of relative parent traversal.

Forbidden:

- `domain` importing React, component code, browser APIs, API clients, or routing code.
- `apis` exposing raw DTOs to components or pages.
- Components implementing business rules or redefining domain models.
- Pages containing business logic.
- Cross-context coupling except through explicit domain contracts.
- Cross-context circular dependencies.
- Duplicated definitions for the same domain concept.

When dependency direction is ambiguous, keep domain pure and move orchestration outward.

## Graph Facade

Within the graph-visualization module, `graphFacade.ts` is the reconciliation point between the Redux store, React contexts, and React Query when server state is involved.

The facade owns the plumbing required to combine these state sources and exposes ready-to-use hooks for components. Components should consume those hooks instead of repeating cross-source selection, dispatch, context access, or query wiring. Keep component-specific rendering and lifecycle effects colocated with their owning components rather than adding them to the facade.

## Domain Layer

The `domain/` directory is the single source of truth for a module’s business concepts and rules.

It contains:

- Entity interfaces and domain types.
- Invariants and validation rules.
- Pure business logic functions.
- Domain contracts used by other modules.

Rules:

- Use pure functions only.
- No React, APIs, DTOs, storage, network, timers, random values, browser globals, routing, or side effects.
- Place code here because it expresses business meaning or rules. Purity and independence from React are necessary but do not establish domain ownership.
- UI concerns belong in presentation files, even when implemented as pure functions or plain TypeScript types.

## APIs Layer

The `apis/` directory is the anti-corruption layer for external communication.

It contains:

- Backend fetch/client functions.
- DTO definitions when needed.
- DTO-to-domain mappers.
- Normalization for inconsistent backend data.

Rules:

- Fetch backend data here.
- Return domain types only.
- Keep DTOs private to the API layer unless a local test needs them.
- Do not place business rules here; call domain functions when validation or derivation is needed.
- Test mapping behavior and HTTP interaction with mocked transport.

GET API conventions:

- For every GET API, expose one function that performs the fetch and one hook that uses `react-query` through that fetch function.
- Name the fetch function after the resource/action, such as `fetchTeachers`.
- Name the query hook `use<FetchFunctionName>`, such as `useFetchTeachers`.
- The query hook must call the fetch function instead of duplicating HTTP logic.
- GET fetch functions must normalize failures through `fromFetchError` from `@common/utils/queryError`.
- GET fetch functions should throw `QueryError<TErrorData>` instead of generic `Error` values for fetch, network, request, and server failures.
- GET query hooks must type their error as `QueryError<TErrorData>` and return `UseQueryResult<TData, QueryError<TErrorData>>`.
- The `useQuery` key must follow the resource path.
- Path segments become query key items.
- Dynamic path parameters use the actual variable value, not the placeholder name.
- Search parameters are grouped into an object as the last item of the query key.

For `/university/:universityId/teachers?sort=asc`, use this key shape:

```ts
['university', universityId, 'teachers', { sort: 'asc' }]
```

Example:

```ts
import { fromFetchError, type QueryError } from '@common/utils/queryError'
import { useQuery, type UseQueryResult } from 'react-query'

import type { Teacher } from '../domain/teacher'

type FetchTeachersOptions = {
  universityId: string
  sort: 'asc' | 'desc'
}

type FetchTeachersErrorData = {
  message: string
}

export async function fetchTeachers({
  universityId,
  sort,
}: FetchTeachersOptions): Promise<Teacher[]> {
  const searchParams = new URLSearchParams({ sort })
  const request = new Request(`/university/${universityId}/teachers?${searchParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  try {
    const response = await fetch(request)

    if (!response.ok) {
      throw await fromFetchError<FetchTeachersErrorData>(request, response)
    }

    return await response.json() as Teacher[]
  } catch (error) {
    throw await fromFetchError<FetchTeachersErrorData>(
      request,
      error instanceof Error ? error : new Error('Unknown error occurred while fetching teachers'),
    )
  }
}

export function useFetchTeachers(
  options: FetchTeachersOptions,
): UseQueryResult<Teacher[], QueryError<FetchTeachersErrorData>> {
  return useQuery<Teacher[], QueryError<FetchTeachersErrorData>>(
    ['university', options.universityId, 'teachers', { sort: options.sort }],
    () => fetchTeachers(options),
  )
}
```

Canonical flow:

```text
API -> DTO -> mapper -> domain model -> domain function -> component render
```

## Components Layer

The `components/` directory contains React rendering, UI orchestration, and supporting presentation files.

Rules:

- Components stay lean.
- File name must match the exported component name.
- Keep a standalone component as a direct `.tsx` file when it has no attached stylesheet or subcomponents.
- Put a component with an attached stylesheet or subcomponents in a folder named after the component. Keep its root component, stylesheet, and private subcomponents inside that folder.
- Expose a folder-based component through `index.ts`, exporting only the root component. Do not export its stylesheet or private subcomponents.
- Use CSS modules for component styles, colocated with the component as `<ComponentName>.module.css` when practical.
- Make CSS module ownership follow component ownership. A component imports its own module for its internal styles; do not import an ancestor or sibling component's CSS module to style it.
- Keep composition styles with the component that controls the composition. Parent layout, child placement, and parent-scoped third-party overrides belong to the parent's CSS module, and may be passed to a child through `className` when needed.
- Use the `classnames` package for conditional class names or combining multiple class names.
- For one-sided conditional rendering, prefer `condition && <Component />` over `condition ? <Component /> : null`. Ensure the condition is boolean so values such as `0` are not rendered accidentally; keep ternaries when both branches render meaningful output.
- Components may call API functions, call domain functions, manage UI state, and compose subcomponents.
- Components must not implement domain rules, duplicate domain types, or normalize backend data.
- Test components with React Testing Library by behavior, not implementation details.
- Components that render GET API data should use the API query hook and the shared `QuerySuspense` component.

### Query Ownership and Result Components

As a rule of thumb, one component owns the query and uses `QuerySuspense` to render success through `children` and errors through `fallback`. Prefer this over branching around `QuerySuspense` to render a separate error path. The owner handles query orchestration, such as triggering requests and refetching.

- Keep simple display-only success and error markup inline. When either case has its own interactions, state, or substantial presentation logic, extract it into an encapsulated component.
- Pass result data or the typed error and necessary callbacks to those components. Let them own their presentation derivation and case-specific hooks, such as error recovery; avoid computing these in the query owner solely to pass them down. Keep reusable UI mappings in presentation files and call them from the component that owns the display.
- Keep state in the query owner only when it must be shared across cases or survive their unmounting. A fallback component can unmount during refetching, so local recovery state should reset only when that matches the intended behavior.
- Choose cached-data behavior deliberately through `keepDataOnError` and `refetching`. Keep query controls outside `QuerySuspense` when appropriate, with their visibility driven by the intended loading, error, and cancellation behavior.

For example, `NodeExplanationSection` owns the explanation query and refetch callback. Its `QuerySuspense` renders `ExplanationContent` for success and `ExplanationError` through `fallback`; `ExplanationError` derives its presentation and owns its recovery hook.

Example:

```tsx
import { QuerySuspense } from '@common/QuerySuspense'
import { useFetchTeachers } from '../../apis/fetchTeachers'

export function TeacherList({ universityId }: TeacherListProps) {
  const teachersQuery = useFetchTeachers({ universityId, sort: 'asc' })

  return (
    <QuerySuspense
      queryState={teachersQuery}
      loading={<div>Loading teachers...</div>}
      fallback={(error) => <div>{error.message}</div>}
    >
      {(teachers) => (
        <ul>
          {teachers.map((teacher) => (
            <li key={teacher.id}>{teacher.name}</li>
          ))}
        </ul>
      )}
    </QuerySuspense>
  )
}
```

For components with attached styles or subcomponents, use a private component folder:

```text
components/
└── NavBar/
    ├── NavBar.tsx
    ├── NavBarOpen.tsx
    ├── NavBarClosed.tsx
    └── index.ts
```

Only `index.ts` is the public API. Subcomponents are private to the folder and must not be imported outside the module.

For example, `GraphNode` imports `GraphNode.module.css` for its node container, variants, label, category, and file name. `GraphViewContent.module.css` retains the graph workspace layout, React Flow canvas overrides, and inspector placement because `GraphViewContent` owns that composition.

## Presentation Files

Choose placement by responsibility, not by whether a function imports React.

- Keep UI mappings, display formatting, translation keys, titles, descriptions, severity/icon choices, recovery-button selection, and view-model types in `*.presentation.ts` files near the owning component or API hook.
- Keep component-private presentation files inside its folder. When sibling components share a mapping, place it beside their folders, such as `components/ExplanationFeedback.presentation.ts`, rather than importing another component’s private files.
- A presentation file near an API hook remains presentation code. Transport and normalization code must not depend on it.
- Presentation code may consume domain types and normalized API results or error contracts. Keep those contracts independent of their UI mapping; do not move them into presentation files or duplicate them.
- For example, an explanation error reason belongs to its owning contract; mapping that reason to a translated title, severity, and Retry button belongs to presentation.
- Keep pure presentation tests alongside the presentation file as `*.presentation.test.ts`. They do not need React Testing Library unless testing rendered behavior.

## Pages Layer

Pages are routing-level aggregators and are not part of domain design.

Rules:

- Pages compose modules and design-system primitives.
- Pages may use multiple modules together.
- Pages must not contain business logic, domain rules, API DTO mapping, or duplicated domain models.
- Move reusable UI into module components or the design system.

## Design System

Shared UI primitives live in `apps/frontend/src/design-system`.

Examples:

- `Button`
- `Modal`
- `Table`
- `Input`

Rules:

- No domain logic.
- No bounded-context imports.
- Components must be reusable across applications.
- Domain module components may import design-system primitives.

## Domain Consistency

A domain concept has exactly one definition across the frontend.

Examples:

- `Sprint` is defined once in the owning module's `domain/`.
- `BacklogItem` is defined once in the owning module's `domain/`.

Never create per-page, per-feature, or UI-specific variants of the same concept. If a view needs derived data, create a pure domain function or a presentation-only view model that composes the canonical domain type without redefining it.

## Cross-Module Collaboration

Modules may depend on other modules only through domain contracts.

Rules:

- Do not copy-paste types between modules.
- Do not redefine shared concepts.
- Put shared meaning in the owning module.
- If two modules need a concept, decide which module owns it before coding.
- If two bounded contexts need to collaborate, define an explicit contract and keep the dependency one-way.

## Code Generation Checklist

Before creating or editing frontend code:

1. Identify the bounded context.
2. Identify the domain module by ubiquitous language.
3. Put pure business logic and domain types in `domain/`.
4. Put backend communication and DTO mapping in `apis/`.
5. Put React rendering and orchestration in `components/`; colocate UI logic and view-model types in presentation files near their component or hook.
6. Put routing composition in `pages/`.
7. Put reusable primitives with no domain knowledge in `design-system/`.
8. Verify no raw DTOs or duplicated domain models leak into components or pages.

## Review Checklist

When reviewing frontend code, flag:

- Business rules inside components or pages.
- Domain files importing React, API clients, routing, or browser globals.
- UI mappings or presentation types in `domain/`, even when pure and framework-independent.
- Transport or domain code depending on presentation files.
- API files returning raw DTOs.
- GET API fetchers or query hooks using generic `Error` instead of `QueryError`.
- Components normalizing backend data.
- Feature-based or page-based modules where a domain module is needed.
- Component files whose names do not match their component exports.
- Plain CSS imports for component-scoped styles where CSS modules should be used.
- Components importing an ancestor or sibling CSS module for their internal styles.
- CSS rules whose ownership does not match the component architecture, such as child internals in a parent module or parent composition rules in a child module.
- Manual string interpolation, array joins, or ternaries for conditional or multiple class names instead of `classnames`.
- Public imports of private subcomponents.
- Cross-context imports without explicit domain contracts.
- Duplicated domain models or UI-specific variants of canonical concepts.

## Testing Expectations

- `domain/`: pure unit tests, no mocks required.
- `apis/`: mock HTTP/transport, test DTO mapping and normalization.
- `components/`: React Testing Library for rendered behavior; pure unit tests for presentation files.
- `pages/`: only composition/routing smoke coverage when useful.

When testing components or hooks that interact with Redux, import `AppShell` from `@common/test-utils/appShell` and wrap the tested components in `<AppShell>`. It initializes an isolated Redux store for each mount and preserves that store across re-renders. Use this shared wrapper instead of manually creating a store and Redux provider in component tests.

## Core Principle

The domain is independent of UI, API, and framework concerns.

Use these placement rules:

- If code expresses business concepts, invariants, or rules, use `domain/`.
- If code communicates with external systems or normalizes their data, use `apis/`.
- If code derives how data or errors should appear to users, use a presentation file near its component or hook.
- If code renders UI, use `components/`.
- If code composes modules for a route, use `pages/`.
