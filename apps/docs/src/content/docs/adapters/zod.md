---
title: Zod
description: Introspect Zod 4 schemas.
---

```sh
pnpm add @schema-introspection/zod
```

```ts
import { toSchemaIntrospection } from "@schema-introspection/zod";
import { z } from "zod";

const { "~introspection": introspection } = toSchemaIntrospection(
  z.object({
    id: z.number().int(),
    name: z.string().optional(),
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
    console.warn(`Unsupported Zod type "${type}"`);
    return undefined; // describe as an unknown node
  },
});
```

The handler receives the schema and its `def.type` tag. Returning `undefined` produces an
`unknown` node annotated with the type; returning a schema describes that schema instead.

## Direction

Zod distinguishes input and output types, and so does the adapter:

- `"input"` reports what the schema accepts; `"output"` reports what it produces.
- Pipes select the input or output schema, so `z.string().pipe(z.coerce.number())` is a string on
  input and a number on output.
- A transform has no output shape: on output it is an `unknown` node annotated with
  `transform: true`.
- Defaults, `catch`, `readonly` and `optional` are annotations on the inner schema. A default makes
  its property required on output and optional on input.

## Mapping

- Objects report `property` edges. `strict`, `loose` and `catchall` differ in their
  `remaining-property` edge (`never`, `any`, or the catchall schema) and report an `unknownKeys`
  annotation.
- Records report a `property-name` edge for keys and a `remaining-property` edge for values, with
  `record: true`.
- Arrays report an `items` edge. Tuples report one `item` edge per position plus an `items` edge
  for the rest schema, or `never` when additional items are rejected.
- Unions report `any-of` edges; discriminated unions and `xor` report `one-of` edges and a
  `discriminator` annotation. Intersections report `all-of` edges.
- `lazy` and recursive schemas are cached, so cycles resolve to the same node object.
- `z.map()` reports `si-zod:map-key` and `si-zod:map-value` edges; `z.set()` reports `si-zod:set-item`;
  `z.promise()` reports `si-zod:promise-value`; `z.function()` reports `si-zod:function-input` and
  `si-zod:function-output`.
- `z.bigint()`, `z.date()`, `z.file()`, `z.nan()`, `z.symbol()`, `z.undefined()` and `z.void()`
  map to namespaced kinds such as `si-zod:date`.
- Constraints and metadata such as `minLength`, `maximum`, `format`, `patterns`, `coerce` and
  `examples` are reported as annotations.

## Context

With a `context.value`, combinator edges narrow to the members that match the value. Narrowing
only removes edges; it never changes the node's kind.
