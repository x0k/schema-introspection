import {
  isJsonSchema,
  type JsonSchema,
  type JsonSchemaObject,
  type JsonSchemaTypeName,
} from "./schema.ts";
import type { SchemaResolver } from "./resolver.ts";
import { isLooseRecord } from "./object.ts";

type ActiveSchemas = Map<unknown, Set<JsonSchema>>;

function asSchema(value: unknown): JsonSchema {
  return isJsonSchema(value) ? value : true;
}

export function jsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }
    return (
      left.length === right.length && left.every((value, index) => jsonEqual(value, right[index]))
    );
  }

  if (isLooseRecord(left) && isLooseRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    return leftKeys.every((key) => Object.hasOwn(right, key) && jsonEqual(left[key], right[key]));
  }

  return false;
}

export function matchesJsonSchemaType(value: unknown, type: JsonSchemaTypeName): boolean {
  switch (type) {
    case "array":
      return Array.isArray(value);
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "null":
      return value === null;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "object":
      return isLooseRecord(value);
    case "string":
      return typeof value === "string";
  }
}

function testPattern(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern, "u").test(value);
  } catch {
    try {
      return new RegExp(pattern).test(value);
    } catch {
      return false;
    }
  }
}

function matchesNumber(schema: JsonSchemaObject, value: number): boolean {
  if (schema.multipleOf !== undefined && schema.multipleOf > 0) {
    const quotient = value / schema.multipleOf;
    const rounded = Math.round(quotient);
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(quotient)) * 8;
    if (Math.abs(quotient - rounded) > tolerance) {
      return false;
    }
  }

  if (schema.maximum !== undefined && value > schema.maximum) {
    return false;
  }

  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
    return false;
  }

  if (schema.minimum !== undefined && value < schema.minimum) {
    return false;
  }

  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
    return false;
  }

  return true;
}

function matchesString(schema: JsonSchemaObject, value: string): boolean {
  const length = [...value].length;
  if (schema.minLength !== undefined && length < schema.minLength) {
    return false;
  }
  if (schema.maxLength !== undefined && length > schema.maxLength) {
    return false;
  }
  if (schema.pattern !== undefined && !testPattern(schema.pattern, value)) {
    return false;
  }
  return true;
}

function matchesArray(
  schema: JsonSchemaObject,
  value: unknown[],
  base: string,
  resolver: SchemaResolver,
  active: ActiveSchemas,
): boolean {
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    return false;
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    return false;
  }

  if (schema.uniqueItems === true) {
    for (let index = 0; index < value.length; index += 1) {
      for (let other = index + 1; other < value.length; other += 1) {
        if (jsonEqual(value[index], value[other])) {
          return false;
        }
      }
    }
  }

  if (Array.isArray(schema.items)) {
    for (let index = 0; index < value.length; index += 1) {
      const itemSchema = schema.items[index];
      if (itemSchema !== undefined) {
        if (!matchesJsonSchema(itemSchema, value[index], base, resolver, active)) {
          return false;
        }
      } else if (
        schema.additionalItems !== undefined &&
        !matchesJsonSchema(schema.additionalItems, value[index], base, resolver, active)
      ) {
        return false;
      }
    }
  } else if (schema.items !== undefined) {
    for (const item of value) {
      if (!matchesJsonSchema(schema.items, item, base, resolver, active)) {
        return false;
      }
    }
  }

  const contains = schema.contains;
  if (contains !== undefined) {
    if (!value.some((item) => matchesJsonSchema(contains, item, base, resolver, active))) {
      return false;
    }
  }

  return true;
}

function patternEntries(value: unknown): Array<readonly [string, JsonSchema]> {
  if (!isLooseRecord(value)) {
    return [];
  }
  const entries: Array<readonly [string, JsonSchema]> = [];
  for (const [pattern, schema] of Object.entries(value)) {
    if (isJsonSchema(schema)) {
      entries.push([pattern, schema]);
    }
  }
  return entries;
}

function matchesObject(
  schema: JsonSchemaObject,
  value: Record<string, unknown>,
  base: string,
  resolver: SchemaResolver,
  active: ActiveSchemas,
): boolean {
  const keys = Object.keys(value);
  if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
    return false;
  }
  if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
    return false;
  }

  if (schema.required !== undefined) {
    for (const name of schema.required) {
      if (!Object.hasOwn(value, name)) {
        return false;
      }
    }
  }

  const properties = isLooseRecord(schema.properties) ? schema.properties : undefined;
  const patterns = patternEntries(schema.patternProperties);

  for (const key of keys) {
    let matched = false;

    if (properties !== undefined && Object.hasOwn(properties, key)) {
      matched = true;
      const propertySchema = properties[key];
      if (!matchesJsonSchema(propertySchema, value[key], base, resolver, active)) {
        return false;
      }
    }

    for (const [pattern, patternSchema] of patterns) {
      if (testPattern(pattern, key)) {
        matched = true;
        if (!matchesJsonSchema(patternSchema, value[key], base, resolver, active)) {
          return false;
        }
      }
    }

    if (
      !matched &&
      schema.additionalProperties !== undefined &&
      !matchesJsonSchema(schema.additionalProperties, value[key], base, resolver, active)
    ) {
      return false;
    }
  }

  if (schema.propertyNames !== undefined) {
    for (const key of keys) {
      if (!matchesJsonSchema(schema.propertyNames, key, base, resolver, active)) {
        return false;
      }
    }
  }

  if (isLooseRecord(schema.dependencies)) {
    for (const [name, dependency] of Object.entries(schema.dependencies)) {
      if (!Object.hasOwn(value, name)) {
        continue;
      }
      if (Array.isArray(dependency)) {
        for (const required of dependency) {
          if (!Object.hasOwn(value, required)) {
            return false;
          }
        }
      } else if (!matchesJsonSchema(dependency, value, base, resolver, active)) {
        return false;
      }
    }
  }

  return true;
}

export function matchesJsonSchema(
  schema: JsonSchema,
  value: unknown,
  base: string,
  resolver: SchemaResolver,
  active: ActiveSchemas = new Map(),
): boolean {
  if (schema === true) {
    return true;
  }
  if (schema === false) {
    return false;
  }

  let activeForValue = active.get(value);
  if (activeForValue === undefined) {
    activeForValue = new Set();
    active.set(value, activeForValue);
  } else if (activeForValue.has(schema)) {
    return true;
  }
  activeForValue.add(schema);

  try {
    if (schema.$ref !== undefined) {
      const resolved = resolver.resolve(schema.$ref, base);
      if (resolved === undefined) {
        return true;
      }
      return matchesJsonSchema(resolved.schema, value, resolved.base, resolver, active);
    }

    if (schema.type !== undefined) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some((type) => matchesJsonSchemaType(value, type))) {
        return false;
      }
    }

    if (
      schema.enum !== undefined &&
      !schema.enum.some((candidate) => jsonEqual(candidate, value))
    ) {
      return false;
    }

    if (Object.hasOwn(schema, "const") && !jsonEqual(schema.const, value)) {
      return false;
    }

    if (typeof value === "number" && !matchesNumber(schema, value)) {
      return false;
    }
    if (typeof value === "string" && !matchesString(schema, value)) {
      return false;
    }
    if (Array.isArray(value) && !matchesArray(schema, value, base, resolver, active)) {
      return false;
    }
    if (isLooseRecord(value) && !matchesObject(schema, value, base, resolver, active)) {
      return false;
    }

    if (schema.allOf !== undefined) {
      for (const child of schema.allOf) {
        if (!matchesJsonSchema(child, value, base, resolver, active)) {
          return false;
        }
      }
    }

    if (schema.anyOf !== undefined) {
      if (!schema.anyOf.some((child) => matchesJsonSchema(child, value, base, resolver, active))) {
        return false;
      }
    }

    if (schema.oneOf !== undefined) {
      let matches = 0;
      for (const child of schema.oneOf) {
        if (matchesJsonSchema(child, value, base, resolver, active)) {
          matches += 1;
        }
      }
      if (matches !== 1) {
        return false;
      }
    }

    if (
      schema.not !== undefined &&
      matchesJsonSchema(asSchema(schema.not), value, base, resolver, active)
    ) {
      return false;
    }

    if (schema.if !== undefined) {
      if (matchesJsonSchema(schema.if, value, base, resolver, active)) {
        if (
          schema.then !== undefined &&
          !matchesJsonSchema(schema.then, value, base, resolver, active)
        ) {
          return false;
        }
      } else if (
        schema.else !== undefined &&
        !matchesJsonSchema(schema.else, value, base, resolver, active)
      ) {
        return false;
      }
    }

    return true;
  } finally {
    activeForValue.delete(schema);
    if (activeForValue.size === 0) {
      active.delete(value);
    }
  }
}
