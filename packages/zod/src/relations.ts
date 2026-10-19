import type { RelationV1 } from "@schema-introspection/spec";

/** A key in a Zod map. */
export interface MapKey {
  readonly relation: "zod:map-key";
}

/** A value in a Zod map. */
export interface MapValue {
  readonly relation: "zod:map-value";
}

/** A value in a Zod set. */
export interface SetItem {
  readonly relation: "zod:set-item";
}

/** The resolved value of a Zod promise. */
export interface PromiseValue {
  readonly relation: "zod:promise-value";
}

/** The arguments tuple of a Zod function. */
export interface FunctionInput {
  readonly relation: "zod:function-input";
}

/** The return schema of a Zod function. */
export interface FunctionOutput {
  readonly relation: "zod:function-output";
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
