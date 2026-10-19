---
title: JSON Schema draft-07
description: Introspect JSON Schema draft-07 documents.
---

```sh
pnpm add @schema-introspection/json-schema-draft-07
```

```ts
import { toSchemaIntrospection } from "@schema-introspection/json-schema-draft-07";

const { "~introspection": introspection } = toSchemaIntrospection({
  type: "object",
  properties: {
    id: { type: "integer" },
  },
  required: ["id"],
});

const node = introspection.introspect({ direction: "input" });

node.kind; // "object"
node.edges; // [{ relation: "property", name: "id", required: true, node }]
```

## Options

| Option                  | Type                                    | Description                                                     |
| ----------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `baseUri`               | `string`                                | Retrieval URI for the root schema.                              |
| `documents`             | `Record<string, JsonSchema>`            | Additional schema documents, keyed by their retrieval URI.      |
| `validator`             | `Validator`                             | Used to resolve conditional and combinator edges in a context.  |
| `merger`                | `Merger`                                | When provided, schemas are merged before they are introspected. |
| `onUnresolvedReference` | `"throw" \| UnresolvedReferenceHandler` | How unresolved references are handled; defaults to `"throw"`.   |

```ts
toSchemaIntrospection(document, {
  baseUri: "https://example.com/schemas/root.json",
  documents: {
    "https://example.com/schemas/person.json": personSchema,
  },
});
```

## References

- `$ref` values are resolved against the effective base URI of the schema that contains them,
  including JSON Pointer fragments.
- `$id` establishes a new base URI; `baseUri` anchors the root document.
- A reference that cannot be resolved is passed to `onUnresolvedReference`. The default throws;
  a handler may return a schema to describe instead, or `undefined` for an `unknown` node
  annotated with the unresolved reference.

## Mapping

- `type` maps to the corresponding kind; boolean schemas map to `any` and `never`.
- Object keywords map to `property`, `pattern-property` (`patternProperties`),
  `remaining-property` (`additionalProperties`) and `property-name` (`propertyNames`) edges.
  Implicitly allowed additional properties surface as a `remaining-property` edge of kind `any`.
- Array keywords map to `item` and `items` edges. `contains` is a
  `si-json-schema-draft-07:contains` edge and `not` is a `si-json-schema-draft-07:not` edge.
- `allOf`, `anyOf`, `oneOf` and `if`/`then`/`else` map to combinator and conditional edges.
  `allOf` children stay separate edges; provide a `merger` to merge them into one schema first.
- Draft-07 keywords such as `format`, `pattern`, `minimum`, `maximum`, `minItems`, `maxLength`
  and `examples` are reported as annotations.

## Context

With a `context.value`, conditional and combinator edges narrow to the branches that apply. This
requires a `validator` to test the value against subschemas; without one, every branch is reported.
