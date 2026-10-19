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

  const missing = introspect({ $ref: "missing.json#/value" }, { direction: "input" });
  assert.equal(missing.kind, "unknown");
  assert.equal(missing.annotations.$ref, "missing.json#/value");
});
