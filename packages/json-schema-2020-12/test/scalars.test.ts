import assert from "node:assert/strict";
import test from "node:test";

import { introspect, kindNode } from "./helpers.ts";

test("scalar annotations and constraints", () => {
  const node = introspect(
    {
      type: "string",
      title: "Email",
      description: "An email address",
      default: "a@example.test",
      examples: ["a@example.test"],
      readOnly: true,
      deprecated: true,
      format: "email",
      minLength: 3,
      maxLength: 254,
      pattern: "@",
      contentMediaType: "text/plain",
      contentEncoding: "identity",
    },
    { direction: "input" },
  );

  assert.equal(node.kind, "string");
  assert.deepEqual(node.annotations, {
    title: "Email",
    description: "An email address",
    default: "a@example.test",
    examples: ["a@example.test"],
    readOnly: true,
    deprecated: true,
    format: "email",
    minLength: 3,
    maxLength: 254,
    pattern: "@",
    contentMediaType: "text/plain",
    contentEncoding: "identity",
  });

  const number = introspect(
    {
      type: "number",
      multipleOf: 0.5,
      exclusiveMinimum: -0.5,
      maximum: 20,
      exclusiveMaximum: 10,
    },
    { direction: "output" },
  );
  const numberNode = kindNode(number, "number");
  assert.equal(numberNode.annotations.exclusiveMinimum, -0.5);
  assert.equal(numberNode.annotations.exclusiveMaximum, 10);
});
