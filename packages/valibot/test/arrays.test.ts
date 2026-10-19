import assert from "node:assert/strict";
import test from "node:test";

import * as v from "valibot";

import { edgeOf, edges, introspect, kindNode } from "./helpers.ts";

test("arrays report their element and length constraints", () => {
  const node = kindNode(
    introspect(v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(3)), { direction: "input" }),
    "array",
  );
  assert.equal(node.annotations.minItems, 1);
  assert.equal(node.annotations.maxItems, 3);
  assert.equal(kindNode(edgeOf(node, "items").node(), "string").kind, "string");

  const nonEmpty = kindNode(
    introspect(v.pipe(v.array(v.string()), v.nonEmpty()), { direction: "input" }),
    "array",
  );
  assert.equal(nonEmpty.annotations.minItems, 1);

  const empty = kindNode(
    introspect(v.pipe(v.array(v.string()), v.empty()), { direction: "input" }),
    "array",
  );
  assert.equal(empty.annotations.maxItems, 0);
});

test("tuples report positions and a rest category", () => {
  const node = kindNode(
    introspect(v.tuple([v.string(), v.number()]), { direction: "input" }),
    "array",
  );
  const itemEdges = edges(node).filter((edge) => edge.relation === "item");
  assert.deepEqual(
    itemEdges.map((edge) => edge.index),
    [0, 1],
  );
  assert.equal(kindNode(itemEdges[0].node(), "string").kind, "string");
  assert.equal(kindNode(itemEdges[1].node(), "number").kind, "number");
  assert.equal(kindNode(edgeOf(node, "items").node(), "never").kind, "never");
});

test("loose tuples accept any extra items and tuple rest schemas type them", () => {
  const loose = kindNode(introspect(v.looseTuple([v.string()]), { direction: "input" }), "array");
  assert.equal(kindNode(edgeOf(loose, "items").node(), "any").kind, "any");

  const rest = kindNode(
    introspect(v.tupleWithRest([v.string()], v.boolean()), { direction: "input" }),
    "array",
  );
  assert.equal(kindNode(edgeOf(rest, "items").node(), "boolean").kind, "boolean");
});

test("maps and sets expose their element schemas", () => {
  const map = kindNode(
    introspect(v.map(v.string(), v.number()), { direction: "input" }),
    "si-valibot:map",
  );
  assert.equal(kindNode(edgeOf(map, "si-valibot:map-key").node(), "string").kind, "string");
  assert.equal(kindNode(edgeOf(map, "si-valibot:map-value").node(), "number").kind, "number");

  const set = kindNode(introspect(v.set(v.string()), { direction: "input" }), "si-valibot:set");
  assert.equal(kindNode(edgeOf(set, "si-valibot:set-item").node(), "string").kind, "string");
});
