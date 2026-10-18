/**
 * Common relation elements. Implementations report any subset, possibly
 * combined with their own namespaced relations; each element is independent,
 * so no aggregate union is exported.
 *
 * A node is either structural (a concrete kind with structural edges) or a
 * combinator (kind `unknown` with combinator or conditional edges). Local
 * structure combined with combinators is an `all-of` node whose children
 * are the structural node and the combinators.
 */
export declare namespace RelationV1 {
  // Structural relations.

  /** A named property. */
  export interface Property {
    readonly relation: "property";
    readonly name: string;
    readonly required: boolean;
  }

  /** Applies its child to property values whose names match `pattern`. */
  export interface PatternProperty {
    readonly relation: "pattern-property";
    readonly pattern: string;
    readonly flags?: string;
  }

  /** Applies its child to names neither `property` nor `pattern-property` matches. */
  export interface AdditionalProperty {
    readonly relation: "additional-property";
  }

  /** Applies its child to property names as strings. */
  export interface PropertyName {
    readonly relation: "property-name";
  }

  /** A tuple position. */
  export interface Item {
    readonly relation: "item";
    readonly index: number;
  }

  /** Applies its child to positions no `item` edge covers. */
  export interface Items {
    readonly relation: "items";
  }

  // Combinator relations.

  /** Exactly one child matches. An enum is `one-of` over `const` nodes. */
  export interface OneOf {
    readonly relation: "one-of";
  }

  /** One or more children match. */
  export interface AnyOf {
    readonly relation: "any-of";
  }

  /** Every child applies; children are not merged. */
  export interface AllOf {
    readonly relation: "all-of";
  }

  // Conditional relations. A conditional node has exactly one edge of each;
  // a branch the schema omits is a child of kind `any`. Several conditions
  // are an `all-of` node over conditional nodes. Property dependencies,
  // e.g. `dependentSchemas` and `dependentRequired`, are conditional nodes
  // whose `if` child requires the dependency property.

  /** The condition; `then` applies when it matches, `else` otherwise. */
  export interface If {
    readonly relation: "if";
  }

  export interface Then {
    readonly relation: "then";
  }

  export interface Else {
    readonly relation: "else";
  }
}
