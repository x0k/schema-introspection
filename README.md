# Schema introspection — interface draft

**Status:** discussion draft. The name and vocabulary are provisional.

The protocol is expressed only as TypeScript, in
[`packages/spec`](./packages/spec). Adapters implement it for concrete schema
languages; the JSON Schema draft-07 adapter lives in
[`packages/json-schema-draft-07`](./packages/json-schema-draft-07).

```ts
import { adapter } from "@schema-introspection/json-schema-draft-07";

const schema = { type: "object", properties: { id: { type: "integer" } } };
const { "~introspection": introspection } = adapter(schema);
const node = introspection.introspect({ direction: "input" });
```

## Development

```sh
pnpm check # typecheck
pnpm build # emit package dist files
pnpm test  # run adapter tests
```
