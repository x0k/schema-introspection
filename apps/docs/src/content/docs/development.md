---
title: Development
description: Repository layout, commands and how to add an adapter.
---

## Layout

```text
packages/
  spec/                    protocol types and the common vocabulary
  json-schema-draft-07/    adapter for JSON Schema draft-07
  json-schema-2020-12/     adapter for JSON Schema 2020-12
  zod/                     adapter for Zod 4
  valibot/                 adapter for Valibot 1
apps/
  docs/                    this documentation site (Astro + Starlight)
```

Each adapter package exports `toSchemaIntrospection`, its `*IntrospectionOptions` type, its vendor
constant, and its vocabulary types. Packages depend only on `@schema-introspection/spec`; the
schema language is a peer dependency.

## Commands

The repository is a pnpm workspace driven by Turborepo.

| Command        | Description                         |
| -------------- | ----------------------------------- |
| `pnpm install` | Install all workspace dependencies. |
| `pnpm fmt`     | Format files with oxfmt.            |
| `pnpm lint`    | Lint with oxlint.                   |
| `pnpm check`   | Type-check packages and tests.      |
| `pnpm build`   | Build packages and the docs site.   |
| `pnpm test`    | Run tests with `node --test`.       |

Run a single package's script with a filter, for example:

```sh
pnpm --filter @schema-introspection/zod test
```

## Docs

The docs site lives in `apps/docs` and is built with Astro and Starlight. Pages are Markdown files
in `apps/docs/src/content/docs`; the sidebar is configured in `apps/docs/astro.config.ts`.

```sh
pnpm --filter @schema-introspection/docs dev
```

The development server is available at `http://localhost:4321/schema-introspection/`. A production
build is written to `apps/docs/dist` and deployed to GitHub Pages by
`.github/workflows/pages.yml`.

## Adding an adapter

1. Implement `SchemaIntrospectionV1` from `@schema-introspection/spec` on the schema type.
2. Expose a `toSchemaIntrospection` function that attaches the `"~introspection"` property, plus an
   options type with at least `onUnsupported` or `onUnresolvedReference` (default `"throw"`).
3. Map each construct to a kind, annotations, and edges; cache nodes per direction so recursion
   terminates and cycles preserve identity.
4. Add tests with `node:test` covering scalars, objects, arrays, combinators, wrappers and
   recursion, plus direction handling.
5. Document the mapping in `apps/docs/src/content/docs/adapters`.
