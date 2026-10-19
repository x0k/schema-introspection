---
title: Protocol
description: The protocol interface, nodes, edges, direction and context.
---

The protocol is expressed only as TypeScript, in
[`@schema-introspection/spec`](https://github.com/x0k/schema-introspection/tree/main/packages/spec).
An implementation is an object that carries it under the `"~introspection"` property:

```ts
interface SchemaIntrospectionV1 {
  readonly "~introspection": {
    readonly version: 1;
    readonly vendor: string;
    readonly introspect: (options: Options) => Node;
  };
}
```

`vendor` identifies the implementation and prefixes the namespaced kinds, relations and annotations
it defines. `introspect` describes the root node for the requested options; describing a node does
not recurse or validate.

## Direction

`introspect` requires a `direction`:

- `"input"` describes the values the schema accepts, for example during validation.
- `"output"` describes the values the schema produces, including transformations and defaults.

The effect of direction is adapter-defined. Schema languages that separate input and output may
change structure, requiredness, or defaults; others, such as JSON Schema, ignore the direction.
It stays required so callers always state intent.

## Context

`context.value` narrows value-dependent structure: combinator and conditional edges are reduced to
the children that apply to the value. Narrowing only removes edges. It never changes the node's
kind and never collapses a combinator with a single remaining edge, so the edge count still reports
how many alternatives apply.

Values passed to an edge's `node()` are child-local: the adapter receives the value that applies to
that child, for example the element of an array rather than the whole array.

## Nodes

A node has exactly one `kind`, an `annotations` object, and an `edges` array.

- `kind` states what the node describes. `"unknown"` means no single kind can be asserted, not
  that every value is accepted. `"any"` accepts every value, `"never"` accepts none, and
  `"integer"` is a refinement of `"number"`.
- `annotations` carries descriptive, constraining, or implementation-specific information.
- `edges` lists direct child relations, in stable order. Coverage is exhaustive per relation that
  applies to the node, so an absent relation means unknown coverage, not zero edges. Unconstrained
  categories report a child of kind `any`, for example implicitly allowed additional properties;
  rejected categories report kind `never`.

Common kinds: `object`, `array`, `string`, `number`, `integer`, `boolean`, `null`, plus the
`unknown`, `any` and `never` states. Implementations may add namespaced kinds such as `si-zod:date` or
`si-valibot:set`.

## Edges

An edge exposes its child node lazily:

```ts
type Edge = Relation & {
  readonly node: (context?: Context) => Node;
};
```

Following edges from the root maps a validation issue path back to nodes: `property` adds its name,
`item` its index, `items` the index of the value, while combinator and conditional edges add no
segment. Calls without a context for the same effective target return the same node object, which
preserves cycles.

Common relations:

| Relation             | Applies to                                           |
| -------------------- | ---------------------------------------------------- |
| `property`           | A named property, with `name` and `required`         |
| `pattern-property`   | Property values whose names match `pattern`          |
| `remaining-property` | Names neither `property` nor `pattern-property` hits |
| `property-name`      | Property names as strings, e.g. `propertyNames`      |
| `item`               | A tuple position, with `index`                       |
| `items`              | Positions no `item` edge covers                      |
| `one-of`             | Exactly one child matches                            |
| `any-of`             | One or more children match                           |
| `all-of`             | Every child applies; children are not merged         |
| `if`, `then`, `else` | Conditional branches; a missing branch is `any`      |

Each relation element is independent; implementations report any subset and may add namespaced
relations such as `si-json-schema-2020-12:unevaluated-property`.

A node is either structural (a concrete kind with structural edges) or a combinator (kind
`"unknown"` with combinator or conditional edges). Local structure combined with combinators is an
`all-of` node whose children are the structural node and the combinators.

## Annotations

The common vocabulary defines `title`, `description`, `default` and `const`. Everything else is
defined by implementations, which extend the shared shape per kind. Consumers treat a kind they do
not recognize as `unknown`, and a relation they do not recognize as absent.

## Example

```ts
import { toSchemaIntrospection } from "@schema-introspection/zod";
import { z } from "zod";

const schema = z.object({
  id: z.number().int(),
  name: z.string().default("anonymous"),
});

const { "~introspection": introspection } = toSchemaIntrospection(schema);
const root = introspection.introspect({ direction: "input" });

for (const edge of root.edges) {
  if (edge.relation === "property") {
    console.log(edge.name, edge.required, edge.node().kind);
  }
}
// id true integer
// name false string
```

Continue with the [adapters](../adapters/) to see how each schema language maps onto the protocol.
