---
title: JSON Schema 2020-12
description: Introspect JSON Schema 2020-12 documents.
---

```sh
pnpm add @schema-introspection/json-schema-2020-12
```

```ts
import { toSchemaIntrospection } from "@schema-introspection/json-schema-2020-12";

const { "~introspection": introspection } = toSchemaIntrospection({
  type: "array",
  prefixItems: [{ type: "string" }, { type: "integer" }],
  items: { type: "boolean" },
});

const node = introspection.introspect({ direction: "input" });

node.kind; // "array"
node.edges; // [item 0 string, item 1 integer, items boolean]
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
  including JSON Pointer fragments; `$id` establishes a new base URI and `$anchor` names a
  location.
- `$dynamicRef` and `$dynamicAnchor` are resolved through the dynamic scope of the document.
- A reference that cannot be resolved is passed to `onUnresolvedReference`. The default throws;
  a handler may return a schema to describe instead, or `undefined` for an `unknown` node
  annotated with the unresolved reference.

## Mapping

- `type` maps to the corresponding kind; boolean schemas map to `any` and `never`.
- Object keywords map to `property`, `pattern-property` (`patternProperties`),
  `remaining-property` (`additionalProperties`), `property-name` (`propertyNames`) and
  `si-json-schema-2020-12:unevaluated-property` (`unevaluatedProperties`) edges.
- Array keywords map to `item` (`prefixItems` entries) and `items` edges.
  `contains` is a `si-json-schema-2020-12:contains` edge and `not` is a `si-json-schema-2020-12:not`
  edge.
- `allOf`, `anyOf`, `oneOf` and `if`/`then`/`else` map to combinator and conditional edges.
  `allOf` children stay separate edges; provide a `merger` to merge them into one schema first.
- Keywords such as `format`, `pattern`, `contentEncoding`, `deprecated` and `examples` are
  reported as annotations.

## Context

With a `context.value`, conditional and combinator edges narrow to the branches that apply. This
requires a `validator` to test the value against subschemas; without one, every branch is reported.
