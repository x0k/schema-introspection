import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { edges, introspect, kindNode } from "./helpers.ts";

test("unions are any-of and narrow with a context value", () => {
  const schema = z.union([z.string(), z.number()]);
  const open = kindNode(introspect(schema, { direction: "input" }), "unknown");
  assert.deepEqual(
    edges(open).map((edge) => edge.relation),
    ["any-of", "any-of"],
  );

  const narrowedToNumber = kindNode(
    introspect(schema, { direction: "input", context: { value: 1 } }),
    "unknown",
  );
  assert.equal(edges(narrowedToNumber).length, 1);
  assert.equal(kindNode(edges(narrowedToNumber)[0].node(), "number").kind, "number");
});

test("discriminated unions and xor are one-of", () => {
  const discriminated = z.discriminatedUnion("type", [
    z.object({ type: z.literal("a"), value: z.string() }),
    z.object({ type: z.literal("b"), value: z.number() }),
  ]);
  const node = kindNode(introspect(discriminated, { direction: "input" }), "unknown");
  assert.equal(node.annotations.discriminator, "type");
  assert.deepEqual(
    edges(node).map((edge) => edge.relation),
    ["one-of", "one-of"],
  );

  const xor = kindNode(
    introspect(z.xor([z.object({ a: z.string() }), z.object({ b: z.number() })]), {
      direction: "input",
    }),
    "unknown",
  );
  assert.deepEqual(
    edges(xor).map((edge) => edge.relation),
    ["one-of", "one-of"],
  );
});

test("intersections are all-of", () => {
  const node = kindNode(
    introspect(z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })), {
      direction: "input",
    }),
    "unknown",
  );
  assert.deepEqual(
    edges(node).map((edge) => edge.relation),
    ["all-of", "all-of"],
  );
});

test("literals and enums are const branches", () => {
  const literal = kindNode(introspect(z.literal("a"), { direction: "input" }), "string");
  assert.equal(literal.annotations.const, "a");

  const literals = kindNode(introspect(z.literal(["a", 1]), { direction: "input" }), "unknown");
  assert.deepEqual(
    edges(literals).map((edge) => edge.relation),
    ["one-of", "one-of"],
  );
  assert.equal(kindNode(edges(literals)[0].node(), "string").annotations.const, "a");
  assert.equal(kindNode(edges(literals)[1].node(), "integer").annotations.const, 1);

  const values = kindNode(introspect(z.enum(["a", "b"]), { direction: "input" }), "unknown");
  assert.deepEqual(
    edges(values).map((edge) => edge.relation),
    ["one-of", "one-of"],
  );
});

test("nullable exposes a null branch and narrows with a context value", () => {
  const schema = z.string().nullable();
  const open = kindNode(introspect(schema, { direction: "input" }), "unknown");
  assert.equal(open.annotations.nullable, true);
  assert.equal(edges(open).length, 2);
  assert.equal(kindNode(edges(open)[1].node(), "null").kind, "null");

  const narrowed = kindNode(
    introspect(schema, { direction: "input", context: { value: null } }),
    "unknown",
  );
  assert.equal(edges(narrowed).length, 1);
  assert.equal(kindNode(edges(narrowed)[0].node(), "null").kind, "null");
});
