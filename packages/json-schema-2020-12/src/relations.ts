import type { RelationV1 } from "@schema-introspection/spec";

/** The array has an item matching this child; validation paths do not descend. */
export interface Contains {
  readonly relation: "si-json-schema-2020-12:contains";
}

/** The value must not match this child; validation paths do not descend. */
export interface Not {
  readonly relation: "si-json-schema-2020-12:not";
}

/** An array item not evaluated by another in-place applicator. */
export interface UnevaluatedItem {
  readonly relation: "si-json-schema-2020-12:unevaluated-item";
}

/** An object property not evaluated by another in-place applicator. */
export interface UnevaluatedProperty {
  readonly relation: "si-json-schema-2020-12:unevaluated-property";
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
  | RelationV1.If
  | RelationV1.Then
  | RelationV1.Else
  | Contains
  | Not
  | UnevaluatedItem
  | UnevaluatedProperty;
