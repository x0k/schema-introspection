import assert from "node:assert/strict";
import test from "node:test";

import { edgeOf, edges, introspect, kindNode } from "./helpers.ts";

test("tuple, additional and contains array edges", () => {
  const node = introspect(
    {
      type: "array",
      items: [{ type: "string" }, { type: "number" }],
      additionalItems: false,
      contains: { const: 1 },
      minItems: 1,
      uniqueItems: true,
    },
    { direction: "input" },
  );

  const arrayNode = kindNode(node, "array");
  assert.equal(arrayNode.annotations.minItems, 1);
  assert.equal(arrayNode.annotations.uniqueItems, true);

  const items = edges(node).filter((edge) => edge.relation === "item");
  assert.deepEqual(
    items.map((edge) => edge.index),
    [0, 1],
  );
  assert.equal(items[0].node().kind, "string");
  assert.equal(items[1].node().kind, "number");

  const additional = edgeOf(node, "items");
  assert.equal(additional.node().kind, "never");

  const contains = edgeOf(node, "si-json-schema-draft-07:contains");
  assert.equal(contains.node().kind, "integer");
});

test("unconstrained array category exposes an any child", () => {
  const array = introspect({ type: "array" }, { direction: "input" });
  assert.equal(edgeOf(array, "items").node().kind, "any");
});
