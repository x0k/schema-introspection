import type { JSONSchema } from "json-schema-typed";

import { isObject } from "./object.ts";

export type { JSONSchema } from "json-schema-typed";

export type JsonSchema = JSONSchema;

export type JsonSchemaObject = JSONSchema.Interface;

export type JsonSchemaTypeName =
  | "array"
  | "boolean"
  | "integer"
  | "null"
  | "number"
  | "object"
  | "string";

const TYPE_NAMES: ReadonlySet<string> = new Set([
  "array",
  "boolean",
  "integer",
  "null",
  "number",
  "object",
  "string",
]);

export function isJsonSchemaTypeName(value: unknown): value is JsonSchemaTypeName {
  return typeof value === "string" && TYPE_NAMES.has(value);
}

export function isSchemaObject(value: unknown): value is JsonSchemaObject {
  return isObject(value) && !Array.isArray(value);
}

export function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === "boolean" || isSchemaObject(value);
}
