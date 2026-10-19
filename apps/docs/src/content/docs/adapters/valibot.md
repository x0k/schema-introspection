---
title: Valibot
description: Introspect Valibot 1 schemas.
---

```sh
pnpm add @schema-introspection/valibot
```

```ts
import { toSchemaIntrospection } from "@schema-introspection/valibot";
import * as v from "valibot";

const { "~introspection": introspection } = toSchemaIntrospection(
  v.object({
    id: v.pipe(v.number(), v.integer()),
    name: v.optional(v.string()),
  }),
);

const node = introspection.introspect({ direction: "input" });

node.kind; // "object"
node.edges; // [id integer required, name string optional]
```

## Options

| Option          | Type                            | Description                                                                     |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `onUnsupported` | `"throw" \| UnsupportedHandler` | How schemas with an unrecognized definition are handled; defaults to `"throw"`. |

```ts
toSchemaIntrospection(customSchema, {
  onUnsupported: (unsupported, type) => {
    console.warn(`Unsupported Valibot type "${type}"`);
    return undefined; // describe as an unknown node
  },
});
```

The handler receives the schema and its `type` tag. Returning `undefined` produces an `unknown`
node annotated with the type; returning a schema describes that schema instead.

## Direction

Valibot distinguishes input and output types, and so does the adapter:

- `"input"` reports what the schema accepts; `"output"` reports what it produces.
- Pipes select the input or output schema, so `v.pipe(v.string(), v.toNumber())` is a string on
  input and a number on output.
- A transform has no output shape: on output it is an `unknown` node annotated with
  `transform: true`.
- `v.brand()` and `v.readonly()` are shape-preserving transformations and apply to both
  directions.
- Defaults are annotations on the inner schema. A default makes its property required on output
  and optional on input.

## Mapping

- Objects report `property` edges; `v.optional()` and `v.exactOptional()` set the `optional`
  annotation. `v.strictObject`, `v.looseObject` and `v.objectWithRest` differ in their
  `remaining-property` edge (`never`, `any`, or the rest schema).
- Records report a `property-name` edge for keys and a `remaining-property` edge for values, with
  `record: true`.
- Arrays report an `items` edge. Tuples report one `item` edge per position plus an `items` edge
  for the rest schema, or `never` when additional items are rejected.
- Unions report `any-of` edges; `v.variant()` reports `one-of` edges and a `discriminator`
  annotation. `v.intersect()` reports `all-of` edges.
- `v.lazy()` and recursive schemas are cached, so cycles resolve to the same node object.
- `v.map()` reports `si-valibot:map-key` and `si-valibot:map-value` edges; `v.set()` reports
  `si-valibot:set-item`. `v.promise()` wraps no schema and has no value edge.
- `v.bigint()`, `v.blob()`, `v.date()`, `v.file()`, `v.function()`, `v.instance()`, `v.nan()`,
  `v.symbol()`, `v.undefined()` and `v.void()` map to namespaced kinds such as `si-valibot:date`.
- Constraints and metadata such as `minLength`, `maximum`, `format`, `patterns`, `examples`,
  `values`, `notValues`, `contentEncoding`, `brands` and `metadata` are reported as annotations.

## Context

With a `context.value`, combinator edges narrow to the members that match the value. Narrowing
only removes edges; it never changes the node's kind.
