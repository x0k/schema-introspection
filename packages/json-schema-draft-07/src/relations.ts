import type { RelationV1 } from "@schema-introspection/spec";

/** The array has an item matching this child; validation paths do not descend. */
export interface Contains {
  readonly relation: "draft07:contains";
}

/** The value must not match this child; validation paths do not descend. */
export interface Not {
  readonly relation: "draft07:not";
}

export type Relation =
  | RelationV1.Property
  | RelationV1.PatternProperty
  | RelationV1.AdditionalProperty
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
  | Not;
