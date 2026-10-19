import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { edgeOf, edges, introspect, kindNode } from "./helpers.ts";

test("arrays report their element and length constraints", () => {
  const node = kindNode(
    introspect(z.array(z.string()).min(1).max(3), { direction: "input" }),
    "array",
  );
  assert.equal(node.annotations.minItems, 1);
  assert.equal(node.annotations.maxItems, 3);
  assert.equal(kindNode(edgeOf(node, "items").node(), "string").kind, "string");
});

test("tuples report positions and a rest category", () => {
  const node = kindNode(
    introspect(z.tuple([z.string(), z.number()]).rest(z.boolean()), { direction: "input" }),
    "array",
  );
  const itemEdges = edges(node).filter((edge) => edge.relation === "item");
  assert.deepEqual(
    itemEdges.map((edge) => edge.index),
    [0, 1],
  );
  assert.equal(kindNode(itemEdges[0].node(), "string").kind, "string");
  assert.equal(kindNode(itemEdges[1].node(), "number").kind, "number");
  assert.equal(kindNode(edgeOf(node, "items").node(), "boolean").kind, "boolean");
});

test("tuples without a rest reject additional items", () => {
  const node = kindNode(introspect(z.tuple([z.string()]), { direction: "input" }), "array");
  assert.equal(kindNode(edgeOf(node, "items").node(), "never").kind, "never");
});

test("maps and sets expose their element schemas", () => {
  const map = kindNode(
    introspect(z.map(z.string(), z.number()), { direction: "input" }),
    "zod:map",
  );
  assert.equal(kindNode(edgeOf(map, "zod:map-key").node(), "string").kind, "string");
  assert.equal(kindNode(edgeOf(map, "zod:map-value").node(), "number").kind, "number");

  const set = kindNode(introspect(z.set(z.string()), { direction: "input" }), "zod:set");
  assert.equal(kindNode(edgeOf(set, "zod:set-item").node(), "string").kind, "string");
});
