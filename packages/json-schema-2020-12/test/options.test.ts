import assert from "node:assert/strict";
import test from "node:test";

import type { JsonSchema, Merger, ResolutionContext, Validator } from "../src/index.ts";

import { edges, introspect, kindNode, property, validates } from "./helpers.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeAllOf(schema: JsonSchema): JsonSchema {
  if (typeof schema === "boolean" || !Array.isArray(schema.allOf)) {
    return schema;
  }

  const { allOf, ...rest } = schema;
  const result: Record<string, unknown> = { ...rest };
  const properties: Record<string, JsonSchema> = { ...schema.properties };
  const required = new Set<string>(schema.required ?? []);

  for (const child of allOf) {
    if (typeof child === "boolean") {
      continue;
    }
    for (const [name, value] of Object.entries(child)) {
      if (name === "allOf") {
        continue;
      }
      if (name === "properties" && isPlainObject(value)) {
        for (const [propertyName, propertySchema] of Object.entries(value)) {
          if (!isPlainObject(propertySchema)) {
            continue;
          }
          const existing = properties[propertyName];
          properties[propertyName] = {
            ...(isPlainObject(existing) ? existing : {}),
            ...propertySchema,
          } as JsonSchema;
        }
      } else if (name === "required" && Array.isArray(value)) {
        for (const propertyName of value) {
          if (typeof propertyName === "string") {
            required.add(propertyName);
          }
        }
      } else {
        result[name] = value;
      }
    }
  }

  result.properties = properties;
  result.required = [...required];
  return result as JsonSchema;
}

test("validator option resolves conditions", () => {
  const schema: JsonSchema = {
    if: { type: "string" },
    // oxlint-disable-next-line unicorn/no-thenable
    then: { minLength: 2 },
    else: { type: "number" },
  };
  const calls: Array<{
    context: ResolutionContext;
    schemaDefinition: JsonSchema;
    value: unknown;
  }> = [];
  const validator: Validator = {
    isValid(context, schemaDefinition, value) {
      calls.push({ context, schemaDefinition, value });
      return validates(schemaDefinition, value);
    },
  };

  const matching = introspect(
    schema,
    { direction: "input", context: { value: "ok" } },
    { validator },
  );
  assert.deepEqual(
    edges(matching).map((edge) => edge.relation),
    ["if", "then"],
  );
  assert.ok(calls.length > 0);
  assert.equal(calls[0].context.rootSchema, schema);
  assert.equal(calls[0].context.rootBaseUri, calls[0].context.baseUri);
  assert.deepEqual(calls[0].context.documents, {});

  const fallbackToElse = introspect(
    schema,
    { direction: "input", context: { value: "ok" } },
    { validator: { isValid: () => false } },
  );
  assert.deepEqual(
    edges(fallbackToElse).map((edge) => edge.relation),
    ["if", "else"],
  );
});

test("validator context exposes documents and effective base URI", () => {
  const documents = {
    "https://example.test/other.json": { type: "string" },
  };
  const contexts: ResolutionContext[] = [];
  const validator: Validator = {
    isValid(context) {
      contexts.push(context);
      return true;
    },
  };
  const schema: JsonSchema = {
    $id: "https://example.test/root.json",
    // oxlint-disable-next-line unicorn/no-thenable
    then: { type: "number" },
    if: { const: 1 },
  };

  introspect(schema, { direction: "input", context: { value: "ok" } }, { documents, validator });
  assert.equal(contexts[0].rootBaseUri, "https://example.test/root.json");
  assert.equal(contexts[0].baseUri, "https://example.test/root.json");
  assert.equal(contexts[0].documents, documents);
});

test("merger option merges all-of before introspection", () => {
  const calls: Array<{ context: ResolutionContext; schema: JsonSchema }> = [];
  const merger: Merger = {
    mergeAllOf(context, schema) {
      calls.push({ context, schema });
      return mergeAllOf(schema);
    },
  };

  const schema: JsonSchema = {
    allOf: [
      {
        type: "object",
        properties: { id: { type: "integer" } },
      },
      {
        required: ["id"],
        properties: { id: { minimum: 0 } },
      },
    ],
  };
  const merged = mergeAllOf(schema);
  assert.equal(validates(merged, { id: 1 }), true);
  assert.equal(validates(merged, { id: -1 }), false);

  const node = introspect(schema, { direction: "input" }, { merger });
  assert.equal(node.kind, "object");
  assert.equal(property(node, "id").required, true);
  const idNode = kindNode(property(node, "id").node(), "integer");
  assert.equal(idNode.annotations.minimum, 0);
  assert.equal(calls[0].schema, schema);
  assert.equal(calls[0].context.rootSchema, schema);
  assert.deepEqual(calls[0].context.documents, {});

  const nested = introspect(
    {
      type: "object",
      properties: {
        value: {
          allOf: [{ type: "string" }, { minLength: 1 }],
        },
      },
    },
    { direction: "input" },
    { merger },
  );
  const value = kindNode(property(nested, "value").node(), "string");
  assert.equal(value.annotations.minLength, 1);
});
