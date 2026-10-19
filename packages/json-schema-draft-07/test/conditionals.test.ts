import assert from "node:assert/strict";
import test from "node:test";

import type { JsonSchema } from "../src/index.ts";

import { edgeOf, edges, introspect, property } from "./helpers.ts";

test("conditionals report every branch or the applicable one", () => {
  const schema: JsonSchema = {
    if: { type: "string" },
    // oxlint-disable-next-line unicorn/no-thenable
    then: { minLength: 2 },
    else: { type: "number" },
  };

  const all = introspect(schema, { direction: "input" });
  assert.deepEqual(
    edges(all).map((edge) => edge.relation),
    ["if", "then", "else"],
  );

  const thenNode = introspect(schema, {
    direction: "input",
    context: { value: "ok" },
  });
  assert.deepEqual(
    edges(thenNode).map((edge) => edge.relation),
    ["if", "then"],
  );

  const elseNode = introspect(schema, {
    direction: "input",
    context: { value: 1 },
  });
  assert.deepEqual(
    edges(elseNode).map((edge) => edge.relation),
    ["if", "else"],
  );
});

test("property dependencies are conditional nodes", () => {
  const schema: JsonSchema = {
    type: "object",
    properties: { a: { type: "string" }, b: { type: "string" } },
    dependencies: { a: ["b"] },
  };

  const all = introspect(schema, { direction: "input" });
  const dependencyParts = edges(all).filter(
    (edge) => edge.relation === "all-of" && edge.node().kind === "unknown",
  );
  const dependencyPart = dependencyParts[0];
  assert.equal(dependencyPart.node().kind, "unknown");
  assert.deepEqual(
    edges(dependencyPart.node()).map((edge) => edge.relation),
    ["if", "then", "else"],
  );

  const presentConditional = dependencyPart.node({
    value: { a: "x", b: "y" },
  });
  assert.deepEqual(
    edges(presentConditional).map((edge) => edge.relation),
    ["if", "then"],
  );
  const thenEdge = edgeOf(presentConditional, "then");
  assert.equal(thenEdge.node().kind, "object");
  assert.equal(property(thenEdge.node(), "b").required, true);

  const absentConditional = dependencyPart.node({ value: { b: "y" } });
  assert.deepEqual(
    edges(absentConditional).map((edge) => edge.relation),
    ["if", "else"],
  );
});
