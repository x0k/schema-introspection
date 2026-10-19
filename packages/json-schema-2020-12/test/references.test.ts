import assert from "node:assert/strict";
import test from "node:test";

import type { JsonSchema } from "../src/index.ts";

import { edges, introspect, kindNode, property } from "./helpers.ts";

test("local references, cycles and nested identifiers", () => {
  const referenced = introspect(
    {
      $ref: "#/$defs/text",
      $defs: {
        text: { type: "string", title: "Text" },
      },
    },
    { direction: "input" },
  );
  assert.equal(referenced.kind, "string");
  assert.equal(referenced.annotations.title, "Text");

  const described = introspect(
    {
      $ref: "#/$defs/text",
      $defs: { text: { type: "string" } },
      description: "Alias for text",
    },
    { direction: "input" },
  );
  assert.equal(described.kind, "string");
  assert.equal(described.annotations.description, "Alias for text");

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
      $defs: {
        sub: { $id: "sub.json", type: "integer" },
        flag: { $anchor: "flag", type: "boolean" },
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

test("dynamic references resolve their static anchor", () => {
  const schema: JsonSchema = {
    $id: "https://example.test/tree.json",
    $dynamicAnchor: "node",
    type: "object",
    properties: {
      next: { $dynamicRef: "#node" },
    },
  };

  const root = introspect(schema, { direction: "input" });
  assert.equal(property(root, "next").node(), root);
});

test("reference siblings are combined with the referenced schema", () => {
  const node = introspect(
    {
      $ref: "#/$defs/text",
      $defs: {
        text: { type: "string", minLength: 2 },
      },
      maxLength: 5,
    },
    { direction: "input" },
  );

  assert.equal(node.kind, "unknown");
  assert.deepEqual(
    edges(node).map((edge) => edge.relation),
    ["all-of", "all-of"],
  );

  const [target, sibling] = edges(node);
  const targetNode = kindNode(target.node(), "string");
  assert.equal(targetNode.annotations.minLength, 2);
  const siblingNode = kindNode(sibling.node(), "string");
  assert.equal(siblingNode.annotations.maxLength, 5);
});

test("external documents and unresolved references", () => {
  const node = introspect(
    {
      type: "object",
      properties: {
        value: { $ref: "other.json#/$defs/value" },
      },
    },
    { direction: "input" },
    {
      documents: {
        "other.json": {
          $defs: {
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
      baseUri: "https://schema-introspection.invalid/json-schema-2020-12/root",
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

test("an unresolved reference handler combines with reference siblings", () => {
  const substituted = introspect(
    { $ref: "missing.json#/value", minLength: 3 },
    { direction: "input" },
    { onUnresolvedReference: () => ({ type: "string" }) },
  );
  assert.equal(substituted.kind, "unknown");
  assert.deepEqual(
    substituted.edges.map((edge) => edge.relation),
    ["all-of", "all-of"],
  );
  const target = kindNode(substituted.edges[0].node(), "string");
  const sibling = kindNode(substituted.edges[1].node(), "string");
  assert.equal(target.annotations.minLength, undefined);
  assert.equal(sibling.annotations.minLength, 3);
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
