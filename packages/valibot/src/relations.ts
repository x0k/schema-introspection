import type { RelationV1 } from "@schema-introspection/spec";

/** A key in a Valibot map. */
export interface MapKey {
  readonly relation: "si-valibot:map-key";
}

/** A value in a Valibot map. */
export interface MapValue {
  readonly relation: "si-valibot:map-value";
}

/** A value in a Valibot set. */
export interface SetItem {
  readonly relation: "si-valibot:set-item";
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
  | SetItem;
