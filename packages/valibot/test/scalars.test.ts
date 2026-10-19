import assert from "node:assert/strict";
import test from "node:test";

import * as v from "valibot";

import { introspect, kindNode } from "./helpers.ts";

test("string checks become annotations", () => {
  const node = kindNode(
    introspect(v.pipe(v.string(), v.minLength(2), v.maxLength(5), v.regex(/^a/), v.email()), {
      direction: "input",
    }),
    "string",
  );
  assert.equal(node.annotations.minLength, 2);
  assert.equal(node.annotations.maxLength, 5);
  assert.equal(node.annotations.pattern, "^a");
  assert.equal(node.annotations.format, "email");
});

test("nested pipes keep their earlier actions", () => {
  const inner = v.pipe(v.string(), v.minLength(2));
  const outer = v.pipe(inner, v.maxLength(4));
  const node = kindNode(introspect(outer, { direction: "input" }), "string");
  assert.equal(node.annotations.minLength, 2);
  assert.equal(node.annotations.maxLength, 4);
});

test("string length, prefixes and byte checks become annotations", () => {
  const node = kindNode(
    introspect(
      v.pipe(v.string(), v.length(3), v.startsWith("a"), v.endsWith("z"), v.includes("q")),
      {
        direction: "input",
      },
    ),
    "string",
  );
  assert.equal(node.annotations.minLength, 3);
  assert.equal(node.annotations.maxLength, 3);
  assert.equal(node.annotations.startsWith, "a");
  assert.equal(node.annotations.endsWith, "z");
  assert.equal(node.annotations.includes, "q");

  const nonEmpty = kindNode(
    introspect(v.pipe(v.string(), v.nonEmpty()), { direction: "input" }),
    "string",
  );
  assert.equal(nonEmpty.annotations.minLength, 1);

  const empty = kindNode(
    introspect(v.pipe(v.string(), v.empty()), { direction: "input" }),
    "string",
  );
  assert.equal(empty.annotations.maxLength, 0);

  const bytes = kindNode(
    introspect(v.pipe(v.string(), v.bytes(4)), { direction: "input" }),
    "string",
  );
  assert.equal(bytes.annotations.minBytes, 4);
  assert.equal(bytes.annotations.maxBytes, 4);

  const base64 = kindNode(
    introspect(v.pipe(v.string(), v.base64()), { direction: "input" }),
    "string",
  );
  assert.equal(base64.annotations.contentEncoding, "base64");
});

test("format actions and regex-backed actions are distinguished", () => {
  const uuid = kindNode(introspect(v.pipe(v.string(), v.uuid()), { direction: "input" }), "string");
  assert.equal(uuid.annotations.format, "uuid");

  const iso = kindNode(
    introspect(v.pipe(v.string(), v.isoDate()), { direction: "input" }),
    "string",
  );
  assert.equal(iso.annotations.format, "iso_date");

  const cuid = kindNode(
    introspect(v.pipe(v.string(), v.cuid2()), { direction: "input" }),
    "string",
  );
  assert.equal(cuid.annotations.format, undefined);
  assert.match(cuid.annotations.pattern ?? "", /\[a-z\]/);
});

test("number checks and integer kinds", () => {
  const number = kindNode(
    introspect(v.pipe(v.number(), v.minValue(0), v.maxValue(10), v.multipleOf(2)), {
      direction: "input",
    }),
    "number",
  );
  assert.equal(number.annotations.minimum, 0);
  assert.equal(number.annotations.maximum, 10);
  assert.equal(number.annotations.multipleOf, 2);

  const exclusive = kindNode(
    introspect(v.pipe(v.number(), v.gtValue(1), v.ltValue(9)), { direction: "input" }),
    "number",
  );
  assert.equal(exclusive.annotations.exclusiveMinimum, 1);
  assert.equal(exclusive.annotations.exclusiveMaximum, 9);

  const integer = kindNode(
    introspect(v.pipe(v.number(), v.integer()), { direction: "input" }),
    "integer",
  );
  assert.equal(integer.annotations.format, undefined);

  const safe = kindNode(
    introspect(v.pipe(v.number(), v.safeInteger()), { direction: "input" }),
    "integer",
  );
  assert.equal(safe.annotations.format, "safe_integer");

  const finite = kindNode(
    introspect(v.pipe(v.number(), v.finite()), { direction: "input" }),
    "number",
  );
  assert.equal(finite.annotations.finite, true);
});

test("value, values and not-value checks become annotations", () => {
  const constant = kindNode(
    introspect(v.pipe(v.string(), v.value("x")), { direction: "input" }),
    "string",
  );
  assert.equal(constant.annotations.const, "x");

  const allowed = kindNode(
    introspect(v.pipe(v.string(), v.values(["x", "y"])), { direction: "input" }),
    "string",
  );
  assert.deepEqual(allowed.annotations.values, ["x", "y"]);

  const rejected = kindNode(
    introspect(v.pipe(v.number(), v.notValues([1, 2])), { direction: "input" }),
    "number",
  );
  assert.deepEqual(rejected.annotations.notValues, [1, 2]);
});

test("date, bigint, set and file constraints", () => {
  const date = kindNode(
    introspect(v.pipe(v.date(), v.minValue(new Date(0)), v.maxValue(new Date(1000))), {
      direction: "input",
    }),
    "valibot:date",
  );
  assert.equal(date.annotations.minimum?.getTime(), 0);
  assert.equal(date.annotations.maximum?.getTime(), 1000);

  const bigint = kindNode(
    introspect(v.pipe(v.bigint(), v.minValue(0n), v.maxValue(10n)), { direction: "input" }),
    "valibot:bigint",
  );
  assert.equal(bigint.annotations.minimum, 0n);
  assert.equal(bigint.annotations.maximum, 10n);

  const set = kindNode(
    introspect(v.pipe(v.set(v.string()), v.minSize(1), v.maxSize(3)), { direction: "input" }),
    "valibot:set",
  );
  assert.equal(set.annotations.minSize, 1);
  assert.equal(set.annotations.maxSize, 3);

  const file = kindNode(
    introspect(v.pipe(v.file(), v.minSize(10), v.maxSize(100), v.mimeType(["image/png"])), {
      direction: "input",
    }),
    "valibot:file",
  );
  assert.equal(file.annotations.minSize, 10);
  assert.equal(file.annotations.maxSize, 100);
  assert.deepEqual(file.annotations.mime, ["image/png"]);
});
