---
title: Adapters
description: Install and use the JSON Schema, Zod and Valibot adapters.
---

An adapter implements the [protocol](../protocol/) for schemas of one schema language. It exposes a
single entry point, `toSchemaIntrospection`, which returns an object that carries the
`"~introspection"` implementation for the schema you pass.

These adapters are reference implementations. The protocol is meant to be implemented natively by
schema libraries, and these packages cover the gap until then.

| Package                                      | Schema language      |
| -------------------------------------------- | -------------------- |
| `@schema-introspection/json-schema-draft-07` | JSON Schema draft-07 |
| `@schema-introspection/json-schema-2020-12`  | JSON Schema 2020-12  |
| `@schema-introspection/zod`                  | Zod 4                |
| `@schema-introspection/valibot`              | Valibot 1            |

## Install

```sh
pnpm add @schema-introspection/zod
```

Each adapter depends only on `@schema-introspection/spec` and its own schema language, which stays
a peer dependency.

## Usage

```ts
import { toSchemaIntrospection } from "@schema-introspection/zod";
import { z } from "zod";

const { "~introspection": introspection } = toSchemaIntrospection(z.string());
const node = introspection.introspect({ direction: "input" });

node.kind; // "string"
```

## Behavior

- `toSchemaIntrospection` captures the schema and returns the introspection object; it does not
  copy or mutate the schema, validate, or traverse anything.
- Describing is lazy: `introspect` builds one node, and each edge builds its child when called.
- Nodes are cached per direction (and base URI for JSON Schema), so repeated edges and recursion
  return the same node object and cycles are preserved.
- Direction is required. Adapters that distinguish input from output adjust requiredness, defaults
  and transformations per direction; JSON Schema adapters ignore it.

## Error handling

Adapters fail fast by default: unsupported constructors and unresolved references throw. Both can
be configured per adapter:

- `onUnsupported` (Zod, Valibot): called with the schema and its type tag when a definition is not
  recognized. Return a schema to describe instead, or `undefined` for an `unknown` node.
- `onUnresolvedReference` (JSON Schema): called with the reference and the resolution context.
  Return a schema to describe instead, or `undefined` for an `unknown` node.

Per-adapter options are documented on the adapter pages.
