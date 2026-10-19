import assert from "node:assert/strict";
import test from "node:test";

import * as v from "valibot";

import { edges, introspect, kindNode } from "./helpers.ts";

test("unions are any-of and narrow with a context value", () => {
  const schema = v.union([v.string(), v.number()]);
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

test("variants are one-of and report their discriminator", () => {
  const schema = v.variant("type", [
    v.object({ type: v.literal("a"), value: v.string() }),
    v.object({ type: v.literal("b"), value: v.number() }),
  ]);
  const node = kindNode(introspect(schema, { direction: "input" }), "unknown");
  assert.equal(node.annotations.discriminator, "type");
  assert.deepEqual(
    edges(node).map((edge) => edge.relation),
    ["one-of", "one-of"],
  );
});

test("intersects are all-of", () => {
  const node = kindNode(
    introspect(v.intersect([v.object({ a: v.string() }), v.object({ b: v.number() })]), {
      direction: "input",
    }),
    "unknown",
  );
  assert.deepEqual(
    edges(node).map((edge) => edge.relation),
    ["all-of", "all-of"],
  );
});

test("literals, picklists and enums are const branches", () => {
  const literal = kindNode(introspect(v.literal("a"), { direction: "input" }), "string");
  assert.equal(literal.annotations.const, "a");

  const picklist = kindNode(introspect(v.picklist(["a", "b"]), { direction: "input" }), "unknown");
  assert.deepEqual(
    edges(picklist).map((edge) => edge.relation),
    ["one-of", "one-of"],
  );
  assert.equal(kindNode(edges(picklist)[0].node(), "string").annotations.const, "a");

  const enumerator = kindNode(
    introspect(v.enum({ A: "a", B: "b" }), { direction: "input" }),
    "unknown",
  );
  assert.equal(edges(enumerator).length, 2);
  assert.equal(kindNode(edges(enumerator)[1].node(), "string").annotations.const, "b");
});

test("nullable and nullish expose their extra branches and narrow with a context value", () => {
  const schema = v.nullable(v.string());
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

  const nullish = kindNode(introspect(v.nullish(v.string()), { direction: "input" }), "unknown");
  assert.equal(nullish.annotations.optional, true);
  assert.deepEqual(
    edges(nullish).map((edge) => edge.node().kind),
    ["string", "null", "si-valibot:undefined"],
  );
});
