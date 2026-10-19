import assert from "node:assert/strict";
import test from "node:test";

import type { JsonSchema } from "../src/index.ts";

import { introspect, property } from "./helpers.ts";

test("local references, cycles and nested identifiers", () => {
  const referenced = introspect(
    {
      $ref: "#/definitions/text",
      definitions: {
        text: { type: "string", title: "Text" },
      },
    },
    { direction: "input" },
  );
  assert.equal(referenced.kind, "string");
  assert.equal(referenced.annotations.title, "Text");

  const recursive: JsonSchema = {
    type: "object",
    properties: { next: { $ref: "#" } },
  };
  const root = introspect(recursive, { direction: "input" });
  assert.equal(property(root, "next").node(), root);

  const identified = introspect(
    {
      $id: "https://example.test/root.json",
      type: "object",
      definitions: {
        sub: { $id: "sub.json", type: "integer" },
        flag: { $id: "#flag", type: "boolean" },
      },
      properties: {
        sub: { $ref: "sub.json" },
        flag: { $ref: "#flag" },
      },
    },
    { direction: "input" },
  );
  assert.equal(property(identified, "sub").node().kind, "integer");
  assert.equal(property(identified, "flag").node().kind, "boolean");
});

test("external documents and unresolved references", () => {
  const node = introspect(
    {
      type: "object",
      properties: {
        value: { $ref: "other.json#/definitions/value" },
      },
    },
    { direction: "input" },
    {
      documents: {
        "other.json": {
          definitions: {
            value: { type: "string" },
          },
        },
      },
    },
  );
  assert.equal(property(node, "value").node().kind, "string");

  assert.throws(
    () => introspect({ $ref: "missing.json#/value" }, { direction: "input" }),
    /Cannot resolve reference "missing\.json#\/value"/,
  );

  assert.throws(
    () =>
      introspect(
        { $ref: "missing.json#/value" },
        { direction: "input" },
        { onUnresolvedReference: "throw" },
      ),
    /Cannot resolve reference "missing\.json#\/value"/,
  );

  const seen: Array<{ reference: string; baseUri: string }> = [];
  const missing = introspect(
    { $ref: "missing.json#/value" },
    { direction: "input" },
    {
      onUnresolvedReference: (reference, context) => {
        seen.push({ reference, baseUri: context.baseUri });
        return undefined;
      },
    },
  );
  assert.equal(missing.kind, "unknown");
  assert.equal(missing.annotations.$ref, "missing.json#/value");
  assert.deepEqual(seen, [
    {
      reference: "missing.json#/value",
      baseUri: "https://schema-introspection.invalid/json-schema-draft-07/root",
    },
  ]);

  const substituted = introspect(
    { $ref: "missing.json#/value" },
    { direction: "input" },
    { onUnresolvedReference: () => ({ type: "string", title: "Fallback" }) },
  );
  assert.equal(substituted.kind, "string");
  assert.equal(substituted.annotations.title, "Fallback");
});

test("an unresolved reference handler that returns the same reference terminates", () => {
  const schema = { $ref: "missing.json#/value" };
  const node = introspect(
    schema,
    { direction: "input" },
    {
      onUnresolvedReference: () => schema,
    },
  );
  assert.equal(node.kind, "unknown");
  assert.equal(node.annotations.$ref, "missing.json#/value");
});
