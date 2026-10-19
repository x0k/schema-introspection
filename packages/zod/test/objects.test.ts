import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { edgeOf, edges, introspect, kindNode, property } from "./helpers.ts";

test("object shapes report properties and direction-aware requiredness", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number().optional(),
    role: z.string().default("user"),
  });

  const input = kindNode(introspect(schema, { direction: "input" }), "object");
  assert.deepEqual(input.annotations.required, ["name"]);
  assert.equal(input.annotations.unknownKeys, "strip");
  assert.equal(property(input, "name").required, true);
  assert.equal(property(input, "age").required, false);
  assert.equal(property(input, "role").required, false);
  assert.equal(property(input, "age").node().annotations.optional, true);
  assert.equal(property(input, "role").node().annotations.default, "user");
  assert.equal(kindNode(edgeOf(input, "remaining-property").node(), "any").kind, "any");

  const output = kindNode(introspect(schema, { direction: "output" }), "object");
  assert.deepEqual(output.annotations.required, ["name", "role"]);
  assert.equal(property(output, "role").required, true);
  assert.equal(kindNode(edgeOf(output, "remaining-property").node(), "never").kind, "never");
});

test("strict, loose and catchall objects differ in remaining properties", () => {
  const strict = kindNode(
    introspect(z.object({ name: z.string() }).strict(), { direction: "input" }),
    "object",
  );
  assert.equal(strict.annotations.unknownKeys, "strict");
  assert.equal(kindNode(edgeOf(strict, "remaining-property").node(), "never").kind, "never");

  const loose = kindNode(
    introspect(z.object({ name: z.string() }).loose(), { direction: "input" }),
    "object",
  );
  assert.equal(loose.annotations.unknownKeys, "loose");
  assert.equal(kindNode(edgeOf(loose, "remaining-property").node(), "any").kind, "any");

  const catchall = kindNode(
    introspect(z.object({ name: z.string() }).catchall(z.number()), { direction: "input" }),
    "object",
  );
  assert.equal(catchall.annotations.unknownKeys, "catchall");
  assert.equal(kindNode(edgeOf(catchall, "remaining-property").node(), "number").kind, "number");
});

test("record exposes key and value schemas", () => {
  const node = kindNode(
    introspect(z.record(z.string(), z.number()), { direction: "input" }),
    "object",
  );
  assert.equal(node.annotations.record, true);
  assert.equal(kindNode(edgeOf(node, "property-name").node(), "string").kind, "string");
  assert.equal(kindNode(edgeOf(node, "remaining-property").node(), "number").kind, "number");
  assert.equal(edges(node).length, 2);
});
