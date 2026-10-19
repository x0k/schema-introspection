import type { JSONSchema7, JSONSchema7Definition, JSONSchema7TypeName } from "json-schema";

import { isObject } from "./object.ts";

export type { JSONSchema7, JSONSchema7Definition, JSONSchema7TypeName } from "json-schema";

export type JsonSchema = JSONSchema7Definition;

export type JsonSchemaObject = JSONSchema7;

export type JsonSchemaTypeName = JSONSchema7TypeName;

export function isSchemaObject(value: unknown): value is JsonSchemaObject {
  return isObject(value) && !Array.isArray(value);
}

export function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === "boolean" || isSchemaObject(value);
}
