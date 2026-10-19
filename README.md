# Schema introspection

A protocol for schema introspection: a uniform graph of typed nodes and lazily resolved edges that
tools can walk one step at a time.

**Status:** discussion draft. The name and vocabulary are provisional.

- [Documentation](https://x0k.github.io/schema-introspection/)
- [Discord](https://discord.gg/hVxFWk7dRn)

## Why

Schema languages differ in structure, but consumers usually need the same things: kinds,
constraints, properties, items and alternatives. The protocol exposes one graph-shaped interface
instead of one adapter per consumer.

- **One node at a time.** Describing a schema never recurses or validates; each edge resolves its
  child lazily.
- **Ordered edges.** Properties, items, combinators and conditionals are explicit relations, so
  validation paths can be mapped back to schema nodes.
- **Direction-aware.** `direction: "input"` and `"output"` let implementations describe accepted
  and produced values separately.
- **Context narrowing.** Passing a value reduces combinator and conditional edges to the branches
  that apply.
- **Fail fast.** Unsupported constructs and unresolved references throw by default and can be
  handled per implementation.
- **Cycles preserved.** Cached nodes make recursive schemas terminate and keep node identity.

## Protocol

An implementation is an object that carries the protocol under the `"~introspection"` property:

```ts
interface SchemaIntrospectionV1 {
  readonly "~introspection": {
    readonly version: 1;
    readonly vendor: string;
    readonly introspect: (options: Options) => Node;
  };
}
```

A node reports exactly one `kind`, an `annotations` object, and an `edges` array. An edge exposes
its child lazily:

```ts
type Edge = Relation & {
  readonly node: (context?: Context) => Node;
};
```

Common relations are `property`, `pattern-property`, `remaining-property`, `property-name`, `item`,
`items`, `one-of`, `any-of`, `all-of`, `if`, `then` and `else`. Implementations may add namespaced
kinds, relations and annotations such as `si-zod:map-key` or
`si-json-schema-2020-12:unevaluated-property`.

Read the full description, including direction, context and the vocabulary, in the
[protocol docs](https://x0k.github.io/schema-introspection/protocol/).

## Usage

```ts
// An implementation of the protocol, e.g. from a reference adapter.
const { "~introspection": introspection } = implementation;

const root = introspection.introspect({ direction: "input" });

root.kind; // "object"

for (const edge of root.edges) {
  if (edge.relation === "property" && edge.name === "id") {
    edge.required; // true
    edge.node().kind; // "integer"
  }
}
```

Consumers rely on the types from [`@schema-introspection/spec`](./packages/spec) and never import a
specific adapter.

## Adapters

Reference adapters live in [`packages/`](./packages): JSON Schema draft-07, JSON Schema 2020-12,
Zod and Valibot. Each exposes `toSchemaIntrospection`, which captures the schema and returns an
implementation without copying or mutating it, and keeps its schema language as a peer dependency.

The adapters are stopgaps: the goal is native support in the schema libraries themselves. See the
[adapters docs](https://x0k.github.io/schema-introspection/adapters/) for install commands,
options and coverage per adapter.

## Development

The repository is a pnpm workspace driven by Turborepo.

```sh
pnpm install # install workspace dependencies
pnpm fmt     # format
pnpm lint    # lint
pnpm check   # typecheck packages and tests
pnpm build   # build packages and the docs site
pnpm test    # run adapter tests
pnpm check:all # run every check above plus package publishing checks
```

Run a single package's script with a filter:

```sh
pnpm --filter @schema-introspection/valibot test
```

The docs site lives in [`apps/docs`](./apps/docs) and is built with Astro and Starlight. Run it
locally with:

```sh
pnpm --filter @schema-introspection/docs dev
```

It is deployed to GitHub Pages by [`.github/workflows/pages.yml`](./.github/workflows/pages.yml).
