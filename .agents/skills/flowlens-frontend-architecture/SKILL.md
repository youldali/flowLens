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

Forbidden:

- `domain` importing React, component code, browser APIs, API clients, or routing code.
- `apis` exposing raw DTOs to components or pages.
- Components implementing business rules or redefining domain models.
- Pages containing business logic.
- Cross-context coupling except through explicit domain contracts.
- Cross-context circular dependencies.
- Duplicated definitions for the same domain concept.

When dependency direction is ambiguous, keep domain pure and move orchestration outward.

## Domain Layer

The `domain/` directory is the single source of truth for a module.

It contains:

- Entity interfaces and domain types.
- Invariants and validation rules.
- Pure business logic functions.
- Domain contracts used by other modules.

Rules:

- Use pure functions only.
- No React, APIs, DTOs, storage, network, timers, random values, browser globals, routing, or side effects.
- If logic can exist without React, it probably belongs here.
- If logic is not purely UI or IO, default it to `domain/`.

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

Canonical flow:

```text
API -> DTO -> mapper -> domain model -> domain function -> component render
```

## Components Layer

The `components/` directory contains React presentation and orchestration only.

Rules:

- Components stay lean.
- File name must match the exported component name.
- Components may call API functions, call domain functions, manage UI state, and compose subcomponents.
- Components must not implement domain rules, duplicate domain types, or normalize backend data.
- Test components with React Testing Library by behavior, not implementation details.

For complex components, use a private component folder:

```text
components/
└── NavBar/
    ├── NavBar.tsx
    ├── NavBarOpen.tsx
    ├── NavBarClosed.tsx
    └── index.ts
```

Only `index.ts` is the public API. Subcomponents are private to the folder and must not be imported outside the module.

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
5. Put React rendering and orchestration in `components/`.
6. Put routing composition in `pages/`.
7. Put reusable primitives with no domain knowledge in `design-system/`.
8. Verify no raw DTOs or duplicated domain models leak into components or pages.

## Review Checklist

When reviewing frontend code, flag:

- Business rules inside components or pages.
- Domain files importing React, API clients, routing, or browser globals.
- API files returning raw DTOs.
- Components normalizing backend data.
- Feature-based or page-based modules where a domain module is needed.
- Component files whose names do not match their component exports.
- Public imports of private subcomponents.
- Cross-context imports without explicit domain contracts.
- Duplicated domain models or UI-specific variants of canonical concepts.

## Testing Expectations

- `domain/`: pure unit tests, no mocks required.
- `apis/`: mock HTTP/transport, test DTO mapping and normalization.
- `components/`: React Testing Library, test behavior and visible output.
- `pages/`: only composition/routing smoke coverage when useful.

## Core Principle

The domain is independent of UI, API, and framework concerns.

Use these placement rules:

- If code can exist without React, prefer `domain/`.
- If code transforms external data, use `apis/`.
- If code renders UI, use `components/`.
- If code composes modules for a route, use `pages/`.
