/** Shared annotations; implementations may extend this shape. */
export declare namespace AnnotationV1 {
  export interface Title {
    readonly title?: string;
  }

  export interface Description {
    readonly description?: string;
  }

  export interface Default {
    /** A suggested static value; introspection never applies it. */
    readonly default?: unknown;
  }

  export interface Const {
    /**
     * The only accepted value, present when the key is, so `undefined` is a
     * valid constant. The node keeps the kind of the value, e.g. `string`.
     */
    readonly const?: unknown;
  }
}
