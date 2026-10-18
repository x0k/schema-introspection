/**
 * Common kind elements. Implementations define their own kinds; exactly one
 * kind per node. `unknown` is always available and means no single kind can
 * be asserted, not that every value is accepted. `any` accepts every value,
 * `never` accepts none, and `integer` is a refinement of `number`.
 *
 * Each kind is an independent element; there is no aggregate union.
 */
export declare namespace KindV1 {
  /** No single kind can be asserted, not that every value is accepted. */
  export type Unknown = "unknown";

  /** Accepts every value. */
  export type Any = "any";

  /** Accepts none. */
  export type Never = "never";

  export type Object = "object";

  export type Array = "array";

  export type String = "string";

  export type Number = "number";

  /** A refinement of `number`. */
  export type Integer = "integer";

  export type Boolean = "boolean";

  export type Null = "null";
}
