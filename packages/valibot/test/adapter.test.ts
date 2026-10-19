import assert from "node:assert/strict";
import test from "node:test";

import * as v from "valibot";

import {
  toSchemaIntrospection,
  VALIBOT_VENDOR,
  type GenericSchema,
  type ValibotSchema,
} from "../src/index.ts";

import { introspect, kindNode } from "./helpers.ts";

test("protocol wrapper exposes the adapter", () => {
  const schema = v.string();
  const introspection = toSchemaIntrospection(schema);
  assert.equal(introspection["~introspection"].version, 1);
  assert.equal(introspection["~introspection"].vendor, VALIBOT_VENDOR);
  assert.equal(introspection["~introspection"].introspect({ direction: "input" }).kind, "string");
});

test("open, any, never and opaque primitives", () => {
  assert.equal(introspect(v.any(), { direction: "input" }).kind, "any");
  assert.equal(introspect(v.unknown(), { direction: "input" }).kind, "any");
  assert.equal(introspect(v.never(), { direction: "input" }).kind, "never");
  assert.equal(introspect(v.null(), { direction: "input" }).kind, "null");
  assert.equal(introspect(v.undefined(), { direction: "input" }).kind, "si-valibot:undefined");
  assert.equal(introspect(v.void(), { direction: "input" }).kind, "si-valibot:void");
  assert.equal(introspect(v.symbol(), { direction: "input" }).kind, "si-valibot:symbol");
  assert.equal(introspect(v.nan(), { direction: "input" }).kind, "si-valibot:nan");
  assert.equal(introspect(v.date(), { direction: "input" }).kind, "si-valibot:date");
  assert.equal(introspect(v.bigint(), { direction: "input" }).kind, "si-valibot:bigint");
  assert.equal(
    introspect(
      v.custom(() => true),
      { direction: "input" },
    ).kind,
    "unknown",
  );
  assert.equal(
    introspect(
      v.custom(() => true),
      { direction: "input" },
    ).annotations.custom,
    true,
  );
});

test("metadata is exposed as annotations", () => {
  const node = introspect(
    v.pipe(
      v.string(),
      v.title("Name"),
      v.description("A name"),
      v.examples(["Ada"]),
      v.metadata({ deprecated: true }),
    ),
    { direction: "input" },
  );
  assert.equal(node.annotations.title, "Name");
  assert.equal(node.annotations.description, "A name");
  assert.deepEqual(node.annotations.examples, ["Ada"]);
  assert.equal(node.annotations.metadata?.deprecated, true);
});

function futureSchema(): GenericSchema {
  return { kind: "schema", type: "future" } as unknown as GenericSchema;
}

test("unrecognized definitions throw by default", () => {
  const future = futureSchema();
  assert.throws(
    () => introspect(future, { direction: "input" }),
    /Unsupported Valibot schema type "future"/,
  );
  assert.throws(
    () => introspect(future, { direction: "input" }, { onUnsupported: "throw" }),
    /Unsupported Valibot schema type "future"/,
  );
});

test("an unsupported handler can report or replace the schema", () => {
  const future = futureSchema();
  const seen: Array<{ schema: ValibotSchema; type: string }> = [];
  const unknown = kindNode(
    introspect(
      future,
      { direction: "input" },
      {
        onUnsupported: (schema, type) => {
          seen.push({ schema, type });
          return undefined;
        },
      },
    ),
    "unknown",
  );
  assert.equal(unknown.annotations.type, "future");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].schema, future);
  assert.equal(seen[0].type, "future");

  const replacement = kindNode(
    introspect(
      future,
      { direction: "input" },
      { onUnsupported: () => v.pipe(v.string(), v.title("Fallback")) },
    ),
    "string",
  );
  assert.equal(replacement.annotations.title, "Fallback");

  const wrapped = kindNode(
    introspect(v.optional(future), { direction: "input" }, { onUnsupported: () => v.number() }),
    "number",
  );
  assert.equal(wrapped.annotations.optional, true);
});

test("an unsupported handler that returns the same schema terminates", () => {
  const future = futureSchema();
  assert.equal(
    introspect(future, { direction: "input" }, { onUnsupported: (schema) => schema }).kind,
    "unknown",
  );
});
