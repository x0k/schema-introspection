import type { ZodType } from "zod";

export type { ZodType } from "zod";

export type ZodSchema = ZodType;

export type ZodDefinition = ZodSchema["_zod"]["def"];

export type ZodDefinitionType = ZodDefinition["type"];

export interface ZodCheckDefinition {
  readonly check?: string;
  readonly format?: string;
  readonly pattern?: RegExp;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly includes?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly length?: number;
  readonly size?: number;
  readonly value?: unknown;
  readonly inclusive?: boolean;
  readonly mime?: readonly string[];
}

export function definitionOf(schema: ZodSchema): ZodDefinition {
  return schema._zod.def;
}

export function definitionType(schema: ZodSchema): ZodDefinitionType {
  return schema._zod.def.type;
}

export function isZodSchema(value: unknown): value is ZodSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    "_zod" in value &&
    "safeParse" in value &&
    typeof (value as { safeParse?: unknown }).safeParse === "function"
  );
}

export function checksOf(schema: ZodSchema): readonly ZodCheckDefinition[] {
  const definition = definitionOf(schema) as ZodDefinition & {
    readonly checks?: readonly unknown[];
    readonly check?: string;
  };
  const checks: ZodCheckDefinition[] = [];
  if (definition.check !== undefined) {
    checks.push(definition as ZodCheckDefinition);
  }
  for (const check of definition.checks ?? []) {
    const checkDefinition = (check as { readonly _zod?: { readonly def?: ZodCheckDefinition } })
      ._zod?.def;
    if (checkDefinition !== undefined) {
      checks.push(checkDefinition);
    }
  }
  return checks;
}
