import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { introspect, kindNode } from "./helpers.ts";

test("string checks become annotations", () => {
  const node = kindNode(
    introspect(z.string().min(2).max(5).regex(/^a/).email(), { direction: "input" }),
    "string",
  );
  assert.equal(node.annotations.minLength, 2);
  assert.equal(node.annotations.maxLength, 5);
  assert.equal(node.annotations.pattern, "^a");
  assert.equal(node.annotations.patterns?.length, 2);
  assert.equal(node.annotations.format, "email");
});

test("string length, prefixes and case checks become annotations", () => {
  const node = kindNode(
    introspect(
      z.string().length(3).startsWith("a").endsWith("z").includes("q").toLowerCase().trim(),
      { direction: "input" },
    ),
    "string",
  );
  assert.equal(node.annotations.minLength, 3);
  assert.equal(node.annotations.maxLength, 3);
  assert.equal(node.annotations.startsWith, "a");
  assert.equal(node.annotations.endsWith, "z");
  assert.equal(node.annotations.includes, "q");
  assert.equal(node.annotations.overwrite, true);
});

test("number checks and integer kinds", () => {
  const number = kindNode(
    introspect(z.number().min(0).max(10).multipleOf(2), { direction: "input" }),
    "number",
  );
  assert.equal(number.annotations.minimum, 0);
  assert.equal(number.annotations.maximum, 10);
  assert.equal(number.annotations.multipleOf, 2);

  const exclusive = kindNode(introspect(z.number().gt(1).lt(9), { direction: "input" }), "number");
  assert.equal(exclusive.annotations.exclusiveMinimum, 1);
  assert.equal(exclusive.annotations.exclusiveMaximum, 9);

  const integer = kindNode(introspect(z.int(), { direction: "input" }), "integer");
  assert.equal(integer.annotations.format, "safeint");

  const coerced = kindNode(introspect(z.coerce.number(), { direction: "input" }), "number");
  assert.equal(coerced.annotations.coerce, true);
});

test("date, bigint, set and file constraints", () => {
  const date = kindNode(
    introspect(z.date().min(new Date(0)).max(new Date(1000)), { direction: "input" }),
    "si-zod:date",
  );
  assert.equal(date.annotations.minimum?.getTime(), 0);
  assert.equal(date.annotations.maximum?.getTime(), 1000);

  const bigint = kindNode(
    introspect(z.bigint().min(0n).max(10n), { direction: "input" }),
    "si-zod:bigint",
  );
  assert.equal(bigint.annotations.minimum, 0n);
  assert.equal(bigint.annotations.maximum, 10n);

  const set = kindNode(
    introspect(z.set(z.string()).min(1).max(3), { direction: "input" }),
    "si-zod:set",
  );
  assert.equal(set.annotations.minSize, 1);
  assert.equal(set.annotations.maxSize, 3);

  const file = kindNode(
    introspect(z.file().min(10).max(100).mime("image/png"), { direction: "input" }),
    "si-zod:file",
  );
  assert.equal(file.annotations.minSize, 10);
  assert.equal(file.annotations.maxSize, 100);
  assert.deepEqual(file.annotations.mime, ["image/png"]);
});

test("format schemas keep their format and pattern", () => {
  const uuid = kindNode(introspect(z.uuid(), { direction: "input" }), "string");
  assert.equal(uuid.annotations.format, "uuid");
  assert.match(uuid.annotations.pattern ?? "", /\[0-9a-fA-F\]/);

  const template = kindNode(
    introspect(z.templateLiteral(["id-", z.number()]), { direction: "input" }),
    "string",
  );
  assert.equal(template.annotations.template, true);
  assert.match(template.annotations.pattern ?? "", /id-/);
});
