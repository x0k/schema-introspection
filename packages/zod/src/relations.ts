import type { RelationV1 } from "@schema-introspection/spec";

/** A key in a Zod map. */
export interface MapKey {
  readonly relation: "si-zod:map-key";
}

/** A value in a Zod map. */
export interface MapValue {
  readonly relation: "si-zod:map-value";
}

/** A value in a Zod set. */
export interface SetItem {
  readonly relation: "si-zod:set-item";
}

/** The resolved value of a Zod promise. */
export interface PromiseValue {
  readonly relation: "si-zod:promise-value";
}

/** The arguments tuple of a Zod function. */
export interface FunctionInput {
  readonly relation: "si-zod:function-input";
}

/** The return schema of a Zod function. */
export interface FunctionOutput {
  readonly relation: "si-zod:function-output";
}

export type Relation =
  | RelationV1.Property
  | RelationV1.PatternProperty
  | RelationV1.RemainingProperty
  | RelationV1.PropertyName
  | RelationV1.Item
  | RelationV1.Items
  | RelationV1.OneOf
  | RelationV1.AnyOf
  | RelationV1.AllOf
  | MapKey
  | MapValue
  | SetItem
  | PromiseValue
  | FunctionInput
  | FunctionOutput;
