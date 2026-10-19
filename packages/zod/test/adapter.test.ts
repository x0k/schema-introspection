import assert from "node:assert/strict";
import test from "node:test";

import { z, type ZodType } from "zod";

import { toSchemaIntrospection, ZOD_VENDOR } from "../src/index.ts";

import { introspect, kindNode } from "./helpers.ts";

test("protocol wrapper exposes the adapter", () => {
  const schema = z.string();
  const introspection = toSchemaIntrospection(schema);
  assert.equal(introspection["~introspection"].version, 1);
  assert.equal(introspection["~introspection"].vendor, ZOD_VENDOR);
  assert.equal(introspection["~introspection"].introspect({ direction: "input" }).kind, "string");
});

test("open, any, never and opaque primitives", () => {
  assert.equal(introspect(z.any(), { direction: "input" }).kind, "any");
  assert.equal(introspect(z.unknown(), { direction: "input" }).kind, "any");
  assert.equal(introspect(z.never(), { direction: "input" }).kind, "never");
  assert.equal(introspect(z.undefined(), { direction: "input" }).kind, "si-zod:undefined");
  assert.equal(introspect(z.void(), { direction: "input" }).kind, "si-zod:void");
  assert.equal(introspect(z.symbol(), { direction: "input" }).kind, "si-zod:symbol");
  assert.equal(introspect(z.nan(), { direction: "input" }).kind, "si-zod:nan");
  assert.equal(introspect(z.date(), { direction: "input" }).kind, "si-zod:date");
  assert.equal(introspect(z.bigint(), { direction: "input" }).kind, "si-zod:bigint");
});

test("metadata is exposed as annotations", () => {
  const node = introspect(
    z
      .string()
      .describe("A name")
      .meta({ title: "Name", deprecated: true, examples: ["Ada"] }),
    { direction: "input" },
  );
  assert.equal(node.annotations.description, "A name");
  assert.equal(node.annotations.title, "Name");
  assert.equal(node.annotations.deprecated, true);
  assert.deepEqual(node.annotations.examples, ["Ada"]);
});

function futureSchema(): ZodType {
  return {
    _zod: { def: { type: "future" } },
    safeParse: () => ({ success: true }),
  } as unknown as ZodType;
}

test("unrecognized definitions throw by default", () => {
  const future = futureSchema();
  assert.throws(
    () => introspect(future, { direction: "input" }),
    /Unsupported Zod schema type "future"/,
  );
  assert.throws(
    () => introspect(future, { direction: "input" }, { onUnsupported: "throw" }),
    /Unsupported Zod schema type "future"/,
  );
});

test("an unsupported handler can report or replace the schema", () => {
  const future = futureSchema();
  const seen: Array<{ schema: ZodType; type: string }> = [];
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
      { onUnsupported: () => z.string().meta({ title: "Fallback" }) },
    ),
    "string",
  );
  assert.equal(replacement.annotations.title, "Fallback");

  const sneaky = z.string();
  (sneaky._zod.def as { type: string }).type = "future";
  const wrapped = kindNode(
    introspect(sneaky.optional(), { direction: "input" }, { onUnsupported: () => z.number() }),
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
