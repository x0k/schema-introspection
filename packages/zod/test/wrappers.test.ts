import assert from "node:assert/strict";
import test from "node:test";

import { z, type ZodType } from "zod";

import { edgeOf, introspect, kindNode, property } from "./helpers.ts";

test("pipes select the input or output schema by direction", () => {
  const schema = z.string().pipe(z.coerce.number());
  const input = kindNode(introspect(schema, { direction: "input" }), "string");
  assert.equal(input.kind, "string");

  const output = kindNode(introspect(schema, { direction: "output" }), "number");
  assert.equal(output.annotations.coerce, true);
});

test("transforms have no output shape", () => {
  const schema = z.string().transform((value) => value.length);
  assert.equal(introspect(schema, { direction: "input" }).kind, "string");
  const output = kindNode(introspect(schema, { direction: "output" }), "unknown");
  assert.equal(output.annotations.transform, true);
});

test("defaults, catch and readonly are annotations on the inner schema", () => {
  const withDefault = kindNode(
    introspect(z.string().default("x"), { direction: "input" }),
    "string",
  );
  assert.equal(withDefault.annotations.default, "x");

  const caught = kindNode(introspect(z.string().catch("x"), { direction: "input" }), "string");
  assert.equal(caught.annotations.catch, true);

  const readonly = kindNode(introspect(z.string().readonly(), { direction: "input" }), "string");
  assert.equal(readonly.annotations.readOnly, true);

  const optional = kindNode(introspect(z.string().optional(), { direction: "input" }), "string");
  assert.equal(optional.annotations.optional, true);
});

test("nonoptional clears optional from its inner schema", () => {
  const node = kindNode(
    introspect(z.string().optional().nonoptional(), { direction: "input" }),
    "string",
  );
  assert.equal(node.annotations.optional, false);
});

test("lazy schemas preserve recursive identity", () => {
  const NodeSchema: ZodType = z.lazy(() =>
    z.object({
      name: z.string(),
      next: NodeSchema.optional(),
    }),
  );

  const root = kindNode(introspect(NodeSchema, { direction: "input" }), "object");
  const next = property(root, "next").node();
  assert.equal(next.kind, "object");
  assert.equal(property(next, "next").node(), next);
});

test("functions and promises expose their input and output schemas", () => {
  const fn = kindNode(
    introspect(z.function({ input: z.tuple([z.string()]), output: z.number() }), {
      direction: "input",
    }),
    "zod:function",
  );
  assert.equal(kindNode(edgeOf(fn, "zod:function-input").node(), "array").kind, "array");
  assert.equal(kindNode(edgeOf(fn, "zod:function-output").node(), "number").kind, "number");

  const promise = kindNode(
    introspect(z.promise(z.string()), { direction: "input" }),
    "zod:promise",
  );
  assert.equal(kindNode(edgeOf(promise, "zod:promise-value").node(), "string").kind, "string");
});
