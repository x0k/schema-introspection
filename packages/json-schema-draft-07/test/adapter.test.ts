import assert from "node:assert/strict";
import test from "node:test";

import { toSchemaIntrospection, JSON_SCHEMA_DRAFT_07_VENDOR } from "../src/index.ts";

import { introspect } from "./helpers.ts";

test("empty and boolean schemas", () => {
  assert.equal(introspect({}, { direction: "input" }).kind, "any");
  assert.equal(introspect(true, { direction: "input" }).kind, "any");
  assert.equal(introspect(false, { direction: "input" }).kind, "never");
});

test("protocol wrapper exposes the adapter", () => {
  const wrapped = toSchemaIntrospection({ type: "string" });
  assert.equal(wrapped["~introspection"].version, 1);
  assert.equal(wrapped["~introspection"].vendor, JSON_SCHEMA_DRAFT_07_VENDOR);

  const first = wrapped["~introspection"].introspect({
    direction: "output",
  });
  const second = wrapped["~introspection"].introspect({
    direction: "input",
  });
  assert.equal(first.kind, "string");
  assert.equal(first, second);
});
