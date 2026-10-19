import assert from "node:assert/strict";
import test from "node:test";

import * as v from "valibot";

import { type GenericSchema } from "../src/index.ts";

import { edges, introspect, kindNode, property } from "./helpers.ts";

test("pipes select the input or output schema by direction", () => {
  const schema = v.pipe(v.string(), v.toNumber());
  const input = kindNode(introspect(schema, { direction: "input" }), "string");
  assert.equal(input.annotations.transform, undefined);

  const output = kindNode(introspect(schema, { direction: "output" }), "unknown");
  assert.equal(output.annotations.transform, true);
});

test("transforms have no output shape", () => {
  const schema = v.pipe(
    v.string(),
    v.transform((value) => value.length),
  );
  assert.equal(introspect(schema, { direction: "input" }).kind, "string");
  const output = kindNode(introspect(schema, { direction: "output" }), "unknown");
  assert.equal(output.annotations.transform, true);
});

test("brand and readonly are shape-preserving transformations", () => {
  const branded = v.pipe(v.number(), v.brand("Meters"));
  const brandInput = kindNode(introspect(branded, { direction: "input" }), "number");
  assert.deepEqual(brandInput.annotations.brands, ["Meters"]);
  const brandOutput = kindNode(introspect(branded, { direction: "output" }), "number");
  assert.deepEqual(brandOutput.annotations.brands, ["Meters"]);

  const readonly = v.pipe(v.number(), v.readonly());
  const readonlyOutput = kindNode(introspect(readonly, { direction: "output" }), "number");
  assert.equal(readonlyOutput.annotations.readOnly, true);
});

test("defaults, fallbacks and optional wrappers are annotations on the inner schema", () => {
  const literalDefault = kindNode(
    introspect(v.optional(v.string(), "x"), { direction: "input" }),
    "string",
  );
  assert.equal(literalDefault.annotations.default, "x");

  const factoryDefault = kindNode(
    introspect(
      v.optional(v.string(), () => "gen"),
      { direction: "input" },
    ),
    "string",
  );
  assert.equal(factoryDefault.annotations.default, "gen");

  const nullishDefault = kindNode(
    introspect(v.nullish(v.string(), "y"), { direction: "input" }),
    "unknown",
  );
  assert.equal(nullishDefault.annotations.default, "y");

  const fallback = kindNode(
    introspect(v.fallback(v.string(), "x"), { direction: "input" }),
    "string",
  );
  assert.equal(fallback.annotations.fallback, true);

  const exactOptional = kindNode(
    introspect(v.exactOptional(v.string()), { direction: "input" }),
    "string",
  );
  assert.equal(exactOptional.annotations.optional, true);
  assert.equal(exactOptional.annotations.exactOptional, true);

  const undefinedable = kindNode(
    introspect(v.undefinedable(v.string()), { direction: "input" }),
    "string",
  );
  assert.equal(undefinedable.annotations.optional, true);
});

test("non-wrappers clear flags from their inner schema", () => {
  const optional = kindNode(
    introspect(v.nonOptional(v.optional(v.string())), { direction: "input" }),
    "string",
  );
  assert.equal(optional.annotations.optional, false);

  const nullable = kindNode(
    introspect(v.nonNullable(v.nullable(v.string())), { direction: "input" }),
    "string",
  );
  assert.equal(nullable.annotations.nullable, false);
});

test("functions, promises and instances expose their kinds", () => {
  const fn = kindNode(introspect(v.function(), { direction: "input" }), "valibot:function");
  assert.equal(fn.kind, "valibot:function");

  const promise = kindNode(introspect(v.promise(), { direction: "input" }), "valibot:promise");
  assert.equal(edges(promise).length, 0);

  const instance = kindNode(
    introspect(v.instance(Date), { direction: "input" }),
    "valibot:instance",
  );
  assert.equal(instance.annotations.class, "Date");
});

test("lazy schemas preserve recursive identity", () => {
  const NodeSchema: GenericSchema = v.lazy(() =>
    v.object({
      name: v.string(),
      next: v.optional(NodeSchema),
    }),
  );

  const root = kindNode(introspect(NodeSchema, { direction: "input" }), "object");
  const next = property(root, "next").node();
  assert.equal(next.kind, "object");
  assert.equal(property(next, "next").node(), next);
});
