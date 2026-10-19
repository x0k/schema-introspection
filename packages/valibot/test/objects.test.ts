import assert from "node:assert/strict";
import test from "node:test";

import * as v from "valibot";

import { edgeOf, edges, introspect, kindNode, property } from "./helpers.ts";

test("object shapes report properties and direction-aware requiredness", () => {
  const schema = v.object({
    name: v.string(),
    age: v.optional(v.number()),
    role: v.optional(v.string(), "user"),
    tag: v.undefinedable(v.string()),
  });

  const input = kindNode(introspect(schema, { direction: "input" }), "object");
  assert.deepEqual(input.annotations.required, ["name", "tag"]);
  assert.equal(input.annotations.unknownKeys, "strip");
  assert.equal(property(input, "name").required, true);
  assert.equal(property(input, "age").required, false);
  assert.equal(property(input, "role").required, false);
  assert.equal(property(input, "age").node().annotations.optional, true);
  assert.equal(property(input, "role").node().annotations.default, "user");
  assert.equal(kindNode(edgeOf(input, "remaining-property").node(), "any").kind, "any");

  const output = kindNode(introspect(schema, { direction: "output" }), "object");
  assert.deepEqual(output.annotations.required, ["name", "role", "tag"]);
  assert.equal(property(output, "role").required, true);
  assert.equal(kindNode(edgeOf(output, "remaining-property").node(), "never").kind, "never");
});

test("missing key semantics follow Valibot: exactOptional and nullish accept gaps", () => {
  const schema = v.object({
    a: v.exactOptional(v.string()),
    b: v.nullish(v.string()),
    c: v.optional(v.string()),
    d: v.string(),
  });
  const node = kindNode(introspect(schema, { direction: "input" }), "object");
  assert.deepEqual(node.annotations.required, ["d"]);
  assert.equal(property(node, "a").node().annotations.exactOptional, true);
  assert.equal(property(node, "b").node().annotations.nullable, true);

  const output = kindNode(introspect(schema, { direction: "output" }), "object");
  assert.deepEqual(output.annotations.required, ["d"]);
});

test("strict, loose and rest objects differ in remaining properties", () => {
  const strict = kindNode(
    introspect(v.strictObject({ name: v.string() }), { direction: "input" }),
    "object",
  );
  assert.equal(strict.annotations.unknownKeys, "strict");
  assert.equal(kindNode(edgeOf(strict, "remaining-property").node(), "never").kind, "never");

  const loose = kindNode(
    introspect(v.looseObject({ name: v.string() }), { direction: "input" }),
    "object",
  );
  assert.equal(loose.annotations.unknownKeys, "loose");
  assert.equal(kindNode(edgeOf(loose, "remaining-property").node(), "any").kind, "any");

  const rest = kindNode(
    introspect(v.objectWithRest({ name: v.string() }, v.number()), { direction: "input" }),
    "object",
  );
  assert.equal(rest.annotations.unknownKeys, "catchall");
  assert.equal(kindNode(edgeOf(rest, "remaining-property").node(), "number").kind, "number");
});

test("entry-count validations become property annotations", () => {
  const node = kindNode(
    introspect(v.pipe(v.object({}), v.entries(3)), { direction: "input" }),
    "object",
  );
  assert.equal(node.annotations.minProperties, 3);
  assert.equal(node.annotations.maxProperties, 3);

  const min = kindNode(
    introspect(v.pipe(v.object({}), v.minEntries(1)), { direction: "input" }),
    "object",
  );
  assert.equal(min.annotations.minProperties, 1);
});

test("partial and required transform entry wrappers", () => {
  const partial = kindNode(
    introspect(v.partial(v.object({ a: v.string() })), { direction: "input" }),
    "object",
  );
  assert.equal(property(partial, "a").required, false);

  const required = kindNode(
    introspect(v.required(v.object({ a: v.optional(v.string()) })), { direction: "input" }),
    "object",
  );
  assert.equal(property(required, "a").required, true);
  assert.equal(property(required, "a").node().annotations.optional, false);
});

test("record exposes key and value schemas", () => {
  const node = kindNode(
    introspect(v.record(v.string(), v.number()), { direction: "input" }),
    "object",
  );
  assert.equal(node.annotations.record, true);
  assert.equal(kindNode(edgeOf(node, "property-name").node(), "string").kind, "string");
  assert.equal(kindNode(edgeOf(node, "remaining-property").node(), "number").kind, "number");
  assert.equal(edges(node).length, 2);
});
