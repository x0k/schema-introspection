import assert from "node:assert/strict";
import test from "node:test";

import { edgeOf, introspect, kindNode, property } from "./helpers.ts";

test("object properties, required names and property categories", () => {
  const node = introspect(
    {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
      },
      required: ["id", "extra"],
      patternProperties: {
        "^x-": { type: "boolean" },
      },
      additionalProperties: false,
      propertyNames: { pattern: "^[a-z-]+$" },
    },
    { direction: "input" },
  );

  const objectNode = kindNode(node, "object");
  assert.deepEqual(objectNode.annotations.required, ["id", "extra"]);

  const id = property(node, "id");
  const name = property(node, "name");
  const extra = property(node, "extra");
  assert.equal(id.required, true);
  assert.equal(id.node().kind, "integer");
  assert.equal(name.required, false);
  assert.equal(name.node().kind, "string");
  assert.equal(extra.required, true);
  assert.equal(extra.node().kind, "any");

  const pattern = edgeOf(node, "pattern-property");
  assert.equal(pattern.pattern, "^x-");
  assert.equal(pattern.node().kind, "boolean");

  const additional = edgeOf(node, "remaining-property");
  assert.equal(additional.node().kind, "never");

  const names = edgeOf(node, "property-name");
  assert.equal(names.node().kind, "string");
});

test("unconstrained object category exposes an any child", () => {
  const object = introspect({ type: "object" }, { direction: "input" });
  assert.equal(edgeOf(object, "remaining-property").node().kind, "any");
});

test("unevaluated properties are exposed as a separate edge", () => {
  const node = introspect(
    {
      type: "object",
      properties: { id: { type: "integer" } },
      unevaluatedProperties: { type: "string" },
    },
    { direction: "input" },
  );

  const unevaluated = edgeOf(node, "json-schema-2020-12:unevaluated-property");
  assert.equal(unevaluated.node().kind, "string");
});
