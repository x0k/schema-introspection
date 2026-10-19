export interface SchemaIntrospectionV1<
  Annotations extends SchemaIntrospectionV1.AnnotationMap<Annotations> =
    SchemaIntrospectionV1.AnyAnnotationMap,
  Relation extends SchemaIntrospectionV1.AnyRelation = SchemaIntrospectionV1.AnyRelation,
> {
  readonly "~introspection": SchemaIntrospectionV1.Props<Annotations, Relation>;
}

export declare namespace SchemaIntrospectionV1 {
  interface AbstractRelation<T extends string> {
    /** Identifies this relationship; its other fields are relation-specific. */
    readonly relation: T;
  }

  /** An explicitly non-narrowed relation shape. */
  type AnyRelation = AbstractRelation<string>;

  /**
   * Annotations per kind, e.g. `{ string: StringAnnotations; ... }`. Kinds are
   * the map's keys; checking `node.kind` narrows `node.annotations`. Every map
   * declares `unknown` for kinds it does not recognize. Annotation pieces are
   * defined by implementations and vocabularies, not by the protocol.
   */
  type AnnotationMap<A> = {
    readonly [K in keyof A]: object;
  } & { readonly unknown: object };

  /** The kinds of an annotation map. */
  type NodeKind<A> = Extract<keyof A, string>;

  /**
   * An explicit annotation map of arbitrary kinds; the default for consumers
   * that skip static narrowing.
   */
  type AnyAnnotationMap = {
    readonly [kind: string]: object;
    readonly unknown: object;
  };

  interface Props<
    Annotations extends AnnotationMap<Annotations> = AnyAnnotationMap,
    Relation extends AnyRelation = AnyRelation,
  > {
    readonly version: 1;
    /** The library or adapter that declares the protocol. */
    readonly vendor: string;
    /**
     * Describes the root node for the requested direction; a view that
     * cannot be described is a node of kind `unknown`. Resolves references
     * on the implementation's side; does not recurse or validate.
     */
    readonly introspect: (options: Options) => Node<Annotations, Relation>;
  }

  /** The direction a view describes. */
  type Direction = "input" | "output";

  interface Context {
    /** Value for the schema node, not a validation input. */
    readonly value: unknown;
  }

  interface Options {
    /** The direction to describe. */
    readonly direction: Direction;
    /**
     * Resolves value-dependent structure. With a value, an implementation may
     * narrow combinator and conditional edges to those that apply to it,
     * e.g. by scoring `one-of` and `any-of` children against the value, or
     * by reporting only the conditional branch that applies. Narrowing only
     * removes edges: it never changes the node's kind or collapses a
     * combinator with a single remaining edge, so the edge count still
     * reports how many alternatives apply. Without a value, every edge is
     * reported.
     */
    readonly context?: Context;
  }

  /** A node of one kind. */
  interface KindNode<
    Annotations extends AnnotationMap<Annotations>,
    Relation extends AnyRelation,
    Kind extends NodeKind<Annotations>,
  > {
    /** Exactly one kind; `unknown` means no single kind can be asserted. */
    readonly kind: Kind;
    /** Descriptive, constraining, or implementation-specific information. */
    readonly annotations: Readonly<Annotations[Kind]>;
    /**
     * Direct child edges, in stable order; always present, empty when the
     * node reports no child relations. Coverage is exhaustive per relation
     * that applies to the node, so an absent relation is unknown, not zero
     * edges. Unconstrained categories report a child of kind `any`, e.g.
     * implicitly allowed additional properties; rejected categories, kind
     * `never`.
     */
    readonly edges: readonly Edge<Annotations, Relation>[];
  }

  /** A node of any kind of the annotation map, discriminated by `kind`. */
  type Node<
    Annotations extends AnnotationMap<Annotations> = AnyAnnotationMap,
    Relation extends AnyRelation = AnyRelation,
  > = {
    readonly [Kind in NodeKind<Annotations>]: KindNode<Annotations, Relation, Kind>;
  }[NodeKind<Annotations>];

  /**
   * A relation plus the child node it lazily exposes. Following edges from
   * the root maps a validation issue path back to nodes: `property` adds its
   * name, `item` its index, `items` the index of the value; combinator and
   * conditional edges add no segment.
   */
  type Edge<
    Annotations extends AnnotationMap<Annotations> = AnyAnnotationMap,
    Relation extends AnyRelation = AnyRelation,
  > = Relation & {
    /**
     * Returns the child node for the same direction; `context.value` is the
     * child-local value. Calls without a context for the same effective
     * target return the same node object, preserving cycles.
     */
    readonly node: (context?: Context) => Node<Annotations, Relation>;
  };
}
