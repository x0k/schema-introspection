import assert from "node:assert/strict";
import test from "node:test";

import type { JsonSchema } from "../src/index.ts";
import { jsonEqual } from "../src/matches.ts";

import { edgeOf, edges, introspect, kindNode } from "./helpers.ts";

test("json equality agrees with JSON Schema on -0 and NaN", () => {
  assert.equal(jsonEqual(-0, 0), true);
  assert.equal(jsonEqual(NaN, NaN), false);
  assert.equal(jsonEqual([-0], [0]), true);
  assert.equal(jsonEqual([NaN], [NaN]), false);
});

test("enum is one-of over const nodes and narrows with context", () => {
  const schema: JsonSchema = { enum: ["a", 1, null] };
  const node = introspect(schema, { direction: "input" });
  assert.equal(node.kind, "unknown");
  assert.equal(edges(node).filter((edge) => edge.relation === "one-of").length, 3);
  assert.deepEqual(
    edges(node).map((edge) => edge.node().kind),
    ["string", "integer", "null"],
  );

  const narrowed = introspect(schema, {
    direction: "input",
    context: { value: 1 },
  });
  assert.equal(edges(narrowed).length, 1);
  const narrowedEnum = edgeOf(narrowed, "one-of").node();
  assert.equal(narrowedEnum.kind, "integer");
  assert.equal(kindNode(narrowedEnum, "integer").annotations.const, 1);
});

test("const keeps the kind of its value", () => {
  const object = introspect({ const: { a: 1 } }, { direction: "input" });
  assert.equal(object.kind, "object");
  assert.deepEqual(object.annotations.const, { a: 1 });

  const nothing = introspect({ const: undefined } as unknown as JsonSchema, {
    direction: "input",
  });
  assert.equal(nothing.kind, "unknown");
  assert.equal(Object.hasOwn(nothing.annotations, "const"), true);
});
