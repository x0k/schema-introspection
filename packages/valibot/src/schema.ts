import type { GenericSchema, GenericSchemaAsync } from "valibot";

export type { GenericSchema, GenericSchemaAsync } from "valibot";

export type ValibotSchema = GenericSchema | GenericSchemaAsync;

export type ValibotDefinition = ValibotSchema;

export interface ValibotActionDefinition {
  readonly kind?: string;
  readonly type?: string;
  readonly async?: boolean;
  readonly requirement?: unknown;
  readonly operation?: unknown;
  readonly name?: unknown;
  readonly title?: unknown;
  readonly description?: unknown;
  readonly examples?: unknown;
  readonly metadata?: unknown;
}

export function definitionOf(schema: ValibotSchema): ValibotDefinition {
  return schema;
}

export function definitionType(schema: ValibotSchema): string {
  return schema.type;
}

export function isValibotSchema(value: unknown): value is ValibotSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly kind?: unknown }).kind === "schema" &&
    typeof (value as { readonly type?: unknown }).type === "string"
  );
}

export function actionsOf(schema: ValibotSchema): readonly ValibotActionDefinition[] {
  const actions: ValibotActionDefinition[] = [];
  collectActions(schema, actions);
  return actions;
}

function collectActions(schema: ValibotSchema, actions: ValibotActionDefinition[]): void {
  const pipe = (schema as { readonly pipe?: unknown }).pipe;
  if (!Array.isArray(pipe)) {
    return;
  }
  for (const item of pipe) {
    if (isValibotSchema(item)) {
      collectActions(item, actions);
      continue;
    }
    if (
      typeof item === "object" &&
      item !== null &&
      typeof (item as { readonly kind?: unknown }).kind === "string"
    ) {
      actions.push(item as ValibotActionDefinition);
    }
  }
}
