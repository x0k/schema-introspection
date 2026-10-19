import assert from "node:assert/strict";
import test from "node:test";

import type { JsonSchema, JsonSchemaObject } from "../src/index.ts";

import { edgeOf, edges, introspect, validates } from "./helpers.ts";

test("local structural and combinator keywords form an all-of node", () => {
  const node = introspect(
    {
      type: "object",
      properties: { a: { type: "string" } },
      anyOf: [{ required: ["a"] }, { required: ["b"] }],
    },
    { direction: "input" },
  );

  assert.equal(node.kind, "unknown");
  const allOf = edges(node).filter((edge) => edge.relation === "all-of");
  assert.equal(allOf.length, 2);
  assert.equal(allOf[0].node().kind, "object");
  assert.equal(allOf[1].node().kind, "unknown");
  assert.equal(edges(allOf[1].node()).filter((edge) => edge.relation === "any-of").length, 2);
});

test("type unions are any-of nodes", () => {
  const schema: JsonSchema = { type: ["string", "null"] };
  const node = introspect(schema, { direction: "input" });
  assert.equal(node.kind, "unknown");
  assert.deepEqual(
    edges(node).map((edge) => edge.node().kind),
    ["string", "null"],
  );

  const narrowed = introspect(schema, {
    direction: "input",
    context: { value: null },
  });
  assert.equal(edges(narrowed).length, 1);
  assert.equal(edgeOf(narrowed, "any-of").node().kind, "null");
});

test("not is exposed as a namespaced relation", () => {
  const node = introspect({ not: { type: "string" } }, { direction: "input" });
  assert.equal(node.kind, "unknown");
  const not = edgeOf(node, "si-json-schema-2020-12:not");
  assert.equal(not.node().kind, "string");
});

test("context narrowing agrees with Ajv for any-of and one-of", () => {
  const schema: JsonSchemaObject = {
    anyOf: [
      { type: "string", minLength: 2 },
      { type: "number", minimum: 5 },
      { type: "object", required: ["id"] },
    ],
  };
  const values = ["a", "long", 3, 9, {}, { id: 1 }, null];

  for (const value of values) {
    const node = introspect(schema, {
      direction: "input",
      context: { value },
    });
    const expected = (schema.anyOf ?? []).filter((child) => validates(child, value)).length;
    assert.equal(edges(node).length, expected);
  }

  const oneOf: JsonSchemaObject = {
    oneOf: [{ type: "number" }, { type: "integer" }, { type: "string" }],
  };
  for (const value of [1.5, 2, "x", true]) {
    const node = introspect(oneOf, {
      direction: "input",
      context: { value },
    });
    const expected = (oneOf.oneOf ?? []).filter((child) => validates(child, value)).length;
    assert.equal(edges(node).length, expected);
  }
});

test("narrowing keeps the combinator when one alternative applies", () => {
  const schema: JsonSchema = {
    anyOf: [{ type: "string" }, { type: "number" }],
  };
  const node = introspect(schema, {
    direction: "input",
    context: { value: "x" },
  });
  assert.equal(node.kind, "unknown");
  const alternatives = edges(node).filter((edge) => edge.relation === "any-of");
  assert.equal(alternatives.length, 1);
  assert.equal(alternatives[0].node().kind, "string");
});
