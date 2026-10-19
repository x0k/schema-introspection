import type { SchemaIntrospectionV1 } from "@schema-introspection/spec";

import type {
  AnnotationMap,
  ArrayAnnotation,
  BigIntAnnotation,
  DateAnnotation,
  FileAnnotation,
  InstanceAnnotation,
  NumberAnnotation,
  ObjectAnnotation,
  SetAnnotation,
  StringAnnotation,
} from "./annotations.ts";
import type { Relation } from "./relations.ts";
import {
  actionsOf,
  isValibotSchema,
  type ValibotActionDefinition,
  type ValibotSchema,
} from "./schema.ts";

type Node = SchemaIntrospectionV1.Node<AnnotationMap, Relation>;

type Edge = SchemaIntrospectionV1.Edge<AnnotationMap, Relation>;

type Context = SchemaIntrospectionV1.Context;

type Direction = SchemaIntrospectionV1.Direction;

const NO_EDGES: readonly Edge[] = [];

const ANY_NODE: Node = { kind: "any", annotations: {}, edges: NO_EDGES };

const NEVER_NODE: Node = { kind: "never", annotations: {}, edges: NO_EDGES };

const NULL_NODE: Node = { kind: "null", annotations: {}, edges: NO_EDGES };

const UNDEFINED_NODE: Node = { kind: "valibot:undefined", annotations: {}, edges: NO_EDGES };

const UNKNOWN_NODE: Node = { kind: "unknown", annotations: {}, edges: NO_EDGES };

const WRAPPER_TYPES: ReadonlySet<string> = new Set(["optional", "exact_optional", "undefinedable"]);

const NULLABLE_TYPES: ReadonlySet<string> = new Set(["nullable", "nullish"]);

const SHAPE_PRESERVING_TRANSFORMATIONS: ReadonlySet<string> = new Set(["brand", "readonly"]);

const FORMAT_ACTIONS: ReadonlySet<string> = new Set([
  "email",
  "ipv4",
  "ipv6",
  "iso_date",
  "iso_date_time",
  "iso_time",
  "iso_timestamp",
  "rfc_email",
  "url",
  "uuid",
]);

const PATTERN_ACTIONS: ReadonlySet<string> = new Set([
  "bic",
  "cuid2",
  "decimal",
  "digits",
  "domain",
  "emoji",
  "hash",
  "hex_color",
  "hexadecimal",
  "isrc",
  "iso_time_second",
  "iso_week",
  "jws_compact",
  "ksuid",
  "mac",
  "mac48",
  "mac64",
  "nanoid",
  "octal",
  "slug",
  "ulid",
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asSchemas(value: unknown): readonly ValibotSchema[] {
  return Array.isArray(value) ? value.filter(isValibotSchema) : [];
}

/**
 * Provides a schema to use when a definition is not recognized. Returning
 * `undefined` produces an `unknown` node annotated with the type. Returning a
 * schema that reproduces the same unsupported type recurses until the
 * adapter's cycle handling stops it.
 */
export interface ValibotUnsupportedHandler {
  (schema: ValibotSchema, type: string): ValibotSchema | undefined;
}

export type ValibotUnsupported = "throw" | ValibotUnsupportedHandler;

export interface ValibotIntrospectionOptions {
  /** How schemas with an unrecognized definition are handled; defaults to `"throw"`. */
  readonly onUnsupported?: ValibotUnsupported;
}

export type ValibotNode = SchemaIntrospectionV1.Node<AnnotationMap, Relation>;

export type ValibotEdge = SchemaIntrospectionV1.Edge<AnnotationMap, Relation>;

export interface ValibotIntrospection extends SchemaIntrospectionV1<AnnotationMap, Relation> {}

export const VALIBOT_VENDOR: string = "valibot";

class Introspector {
  private readonly root: ValibotSchema;
  private readonly onUnsupported: ValibotUnsupported;
  private readonly cache: Map<ValibotSchema, Map<Direction, Node>> = new Map();
  private readonly lazyInner: WeakMap<ValibotSchema, ValibotSchema> = new WeakMap();
  private readonly resolvingLazy: Set<ValibotSchema> = new Set();
  private readonly resolvingUnsupported: Set<ValibotSchema> = new Set();

  constructor(schema: ValibotSchema, options: ValibotIntrospectionOptions) {
    this.root = schema;
    this.onUnsupported = options.onUnsupported ?? "throw";
  }

  introspect(options: SchemaIntrospectionV1.Options): ValibotNode {
    return this.build(this.root, options.direction, options.context, {});
  }

  private build(
    schema: ValibotSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
    cache: boolean = true,
  ): Node {
    const cacheable = context === undefined && cache;
    const cached = cacheable ? this.getCached(schema, direction) : undefined;
    if (cached !== undefined) {
      return cached;
    }

    const node = this.buildUncached(schema, direction, context, extra);
    if (cacheable) {
      this.setCached(schema, direction, node);
    }
    return node;
  }

  private getCached(schema: ValibotSchema, direction: Direction): Node | undefined {
    return this.cache.get(schema)?.get(direction);
  }

  private setCached(schema: ValibotSchema, direction: Direction, node: Node): void {
    let byDirection = this.cache.get(schema);
    if (byDirection === undefined) {
      byDirection = new Map();
      this.cache.set(schema, byDirection);
    }
    byDirection.set(direction, node);
  }

  private buildUncached(
    schema: ValibotSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    if (direction === "output" && this.hasOutputTransformation(schema)) {
      return this.createKindNode(
        "unknown",
        this.annotations(schema, { ...extra, transform: true }),
      );
    }
    switch (schema.type) {
      case "string":
        return this.buildString(schema, direction, extra);
      case "number":
        return this.buildNumber(schema, direction, extra);
      case "boolean":
        return this.createKindNode("boolean", this.annotations(schema, extra));
      case "bigint":
        return this.buildBigInt(schema, direction, extra);
      case "symbol":
        return this.createKindNode("valibot:symbol", this.annotations(schema, extra));
      case "undefined":
        return this.createKindNode("valibot:undefined", this.annotations(schema, extra));
      case "void":
        return this.createKindNode("valibot:void", this.annotations(schema, extra));
      case "null":
        return this.createKindNode("null", this.annotations(schema, extra));
      case "nan":
        return this.createKindNode("valibot:nan", this.annotations(schema, extra));
      case "any":
      case "unknown":
        return this.createKindNode("any", this.annotations(schema, extra));
      case "never":
        return this.createKindNode("never", this.annotations(schema, extra));
      case "date":
        return this.buildDate(schema, direction, extra);
      case "array":
        return this.buildArray(schema, direction, extra);
      case "tuple":
        return this.buildTuple(schema, direction, extra, NEVER_NODE);
      case "strict_tuple":
        return this.buildTuple(schema, direction, extra, NEVER_NODE);
      case "loose_tuple":
        return this.buildTuple(schema, direction, extra, ANY_NODE);
      case "tuple_with_rest":
        return this.buildTupleWithRest(schema, direction, extra);
      case "object":
        return this.buildObject(schema, direction, extra, "strip");
      case "strict_object":
        return this.buildObject(schema, direction, extra, "strict");
      case "loose_object":
        return this.buildObject(schema, direction, extra, "loose");
      case "object_with_rest":
        return this.buildObjectWithRest(schema, direction, extra);
      case "record":
        return this.buildRecord(schema, direction, extra);
      case "map":
        return this.buildMap(schema, direction, extra);
      case "set":
        return this.buildSet(schema, direction, extra);
      case "union":
        return this.buildUnion(schema, direction, context, extra);
      case "variant":
        return this.buildVariant(schema, direction, context, extra);
      case "intersect":
        return this.buildIntersect(schema, direction, extra);
      case "literal":
        return this.buildLiteral(schema, extra);
      case "picklist":
        return this.buildValues(schema, extra);
      case "enum":
        return this.buildValues(schema, extra);
      case "file":
        return this.buildFile(schema, "valibot:file", extra);
      case "blob":
        return this.buildFile(schema, "valibot:blob", extra);
      case "instance":
        return this.buildInstance(schema, extra);
      case "custom":
        return this.createKindNode("unknown", this.annotations(schema, { ...extra, custom: true }));
      case "function":
        return this.createKindNode("valibot:function", this.annotations(schema, extra));
      case "promise":
        return this.createKindNode("valibot:promise", this.annotations(schema, extra));
      case "lazy":
        return this.buildLazy(schema, direction, context, extra);
      case "optional":
      case "exact_optional":
        return this.build(
          this.wrappedOf(schema),
          direction,
          context,
          this.withDefault(schema, {
            ...extra,
            optional: true,
            ...(schema.type === "exact_optional" ? { exactOptional: true } : {}),
          }),
          false,
        );
      case "undefinedable":
        return this.build(
          this.wrappedOf(schema),
          direction,
          context,
          this.withDefault(schema, { ...extra, optional: true }),
          false,
        );
      case "non_optional":
        return this.buildUnwrapped(schema, direction, context, extra, WRAPPER_TYPES, {
          optional: false,
        });
      case "nullable":
        return this.buildNullable(schema, direction, context, this.withDefault(schema, extra));
      case "nullish":
        return this.buildNullish(schema, direction, context, this.withDefault(schema, extra));
      case "non_nullable":
        return this.buildUnwrapped(schema, direction, context, extra, NULLABLE_TYPES, {
          nullable: false,
        });
      case "non_nullish":
        return this.buildUnwrapped(
          schema,
          direction,
          context,
          extra,
          new Set([...WRAPPER_TYPES, ...NULLABLE_TYPES]),
          { nullable: false, optional: false },
        );
      default:
        return this.unsupported(schema, schema.type, direction, context, extra);
    }
  }

  private buildString(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const patterns: string[] = [];
    const patternFlags: string[] = [];

    for (const action of this.validations(schema, direction)) {
      switch (action.type) {
        case "min_length":
          if (typeof action.requirement === "number") {
            annotations.minLength = action.requirement;
          }
          break;
        case "max_length":
          if (typeof action.requirement === "number") {
            annotations.maxLength = action.requirement;
          }
          break;
        case "length":
          if (typeof action.requirement === "number") {
            annotations.minLength = action.requirement;
            annotations.maxLength = action.requirement;
          }
          break;
        case "non_empty":
          if (annotations.minLength === undefined) {
            annotations.minLength = 1;
          }
          break;
        case "empty":
          annotations.minLength = 0;
          annotations.maxLength = 0;
          break;
        case "bytes":
          if (typeof action.requirement === "number") {
            annotations.minBytes = action.requirement;
            annotations.maxBytes = action.requirement;
          }
          break;
        case "min_bytes":
          if (typeof action.requirement === "number") {
            annotations.minBytes = action.requirement;
          }
          break;
        case "max_bytes":
          if (typeof action.requirement === "number") {
            annotations.maxBytes = action.requirement;
          }
          break;
        case "base64":
          annotations.contentEncoding = "base64";
          break;
        case "regex":
          if (action.requirement instanceof RegExp) {
            patterns.push(action.requirement.source);
            patternFlags.push(action.requirement.flags);
          }
          break;
        case "starts_with":
          if (typeof action.requirement === "string") {
            annotations.startsWith = action.requirement;
          }
          break;
        case "ends_with":
          if (typeof action.requirement === "string") {
            annotations.endsWith = action.requirement;
          }
          break;
        case "includes":
          if (typeof action.requirement === "string") {
            annotations.includes = action.requirement;
          }
          break;
        default:
          if (typeof action.type === "string" && FORMAT_ACTIONS.has(action.type)) {
            annotations.format = action.type;
          } else if (
            typeof action.type === "string" &&
            PATTERN_ACTIONS.has(action.type) &&
            action.requirement instanceof RegExp
          ) {
            patterns.push(action.requirement.source);
            patternFlags.push(action.requirement.flags);
          }
      }
    }

    if (patterns.length > 0) {
      annotations.pattern = patterns[0];
      annotations.patternFlags = patternFlags[0];
      annotations.patterns = patterns;
      annotations.patternFlagsList = patternFlags;
    }

    return this.createKindNode("string", annotations as StringAnnotation);
  }

  private buildNumber(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    let integer = false;

    for (const action of this.validations(schema, direction)) {
      switch (action.type) {
        case "min_value":
          if (typeof action.requirement === "number") {
            annotations.minimum = action.requirement;
          }
          break;
        case "max_value":
          if (typeof action.requirement === "number") {
            annotations.maximum = action.requirement;
          }
          break;
        case "gt_value":
          if (typeof action.requirement === "number") {
            annotations.exclusiveMinimum = action.requirement;
          }
          break;
        case "lt_value":
          if (typeof action.requirement === "number") {
            annotations.exclusiveMaximum = action.requirement;
          }
          break;
        case "multiple_of":
          if (typeof action.requirement === "number") {
            annotations.multipleOf = action.requirement;
          }
          break;
        case "integer":
          integer = true;
          break;
        case "safe_integer":
          integer = true;
          annotations.format = "safe_integer";
          break;
        case "finite":
          annotations.finite = true;
          break;
      }
    }

    return this.createKindNode(integer ? "integer" : "number", annotations as NumberAnnotation);
  }

  private buildBigInt(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);

    for (const action of this.validations(schema, direction)) {
      switch (action.type) {
        case "min_value":
          if (typeof action.requirement === "bigint") {
            annotations.minimum = action.requirement;
          }
          break;
        case "max_value":
          if (typeof action.requirement === "bigint") {
            annotations.maximum = action.requirement;
          }
          break;
      }
    }

    return this.createKindNode("valibot:bigint", annotations as BigIntAnnotation);
  }

  private buildDate(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);

    for (const action of this.validations(schema, direction)) {
      switch (action.type) {
        case "min_value":
          if (action.requirement instanceof Date) {
            annotations.minimum = action.requirement;
          }
          break;
        case "max_value":
          if (action.requirement instanceof Date) {
            annotations.maximum = action.requirement;
          }
          break;
      }
    }

    return this.createKindNode("valibot:date", annotations as DateAnnotation);
  }

  private buildArray(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    this.applyLengthValidations(annotations, this.validations(schema, direction));
    const item = (schema as { readonly item?: unknown }).item;
    const edges: Edge[] = [
      isValibotSchema(item)
        ? this.createEdge({ relation: "items" }, item, direction)
        : this.createNodeEdge({ relation: "items" }, UNKNOWN_NODE),
    ];
    return this.createKindNode("array", annotations as ArrayAnnotation, edges);
  }

  private buildTuple(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
    rest: Node,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const items = (schema as { readonly items?: unknown }).items;
    const edges: Edge[] = [];
    for (const [index, item] of asSchemas(items).entries()) {
      edges.push(this.createEdge({ relation: "item", index }, item, direction));
    }
    edges.push(this.createNodeEdge({ relation: "items" }, rest));
    return this.createKindNode("array", annotations as ArrayAnnotation, edges);
  }

  private buildTupleWithRest(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const rest = (schema as { readonly rest?: unknown }).rest;
    if (!isValibotSchema(rest)) {
      return this.buildTuple(schema, direction, extra, ANY_NODE);
    }
    const annotations = this.annotations(schema, extra);
    const items = (schema as { readonly items?: unknown }).items;
    const edges: Edge[] = [];
    for (const [index, item] of asSchemas(items).entries()) {
      edges.push(this.createEdge({ relation: "item", index }, item, direction));
    }
    edges.push(this.createEdge({ relation: "items" }, rest, direction));
    return this.createKindNode("array", annotations as ArrayAnnotation, edges);
  }

  private buildObject(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
    unknownKeys: ObjectAnnotation["unknownKeys"],
  ): Node {
    const annotations = this.annotations(schema, extra);
    this.applyPropertyValidations(annotations, this.validations(schema, direction));
    const rawEntries = (schema as { readonly entries?: unknown }).entries;
    const entries = isRecord(rawEntries) ? rawEntries : {};
    const required: string[] = [];
    const edges: Edge[] = [];

    for (const [name, value] of Object.entries(entries)) {
      if (!isValibotSchema(value)) {
        continue;
      }
      const isRequired = this.isRequired(value, direction);
      if (isRequired) {
        required.push(name);
      }
      edges.push(
        this.createEdge({ relation: "property", name, required: isRequired }, value, direction),
      );
    }

    edges.push(
      this.createNodeEdge(
        { relation: "remaining-property" },
        this.remainingProperty(unknownKeys, direction),
      ),
    );

    annotations.required = required;
    annotations.unknownKeys = unknownKeys;
    return this.createKindNode("object", annotations as ObjectAnnotation, edges);
  }

  private buildObjectWithRest(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    this.applyPropertyValidations(annotations, this.validations(schema, direction));
    const rawEntries = (schema as { readonly entries?: unknown }).entries;
    const entries = isRecord(rawEntries) ? rawEntries : {};
    const rest = (schema as { readonly rest?: unknown }).rest;
    const required: string[] = [];
    const edges: Edge[] = [];

    for (const [name, value] of Object.entries(entries)) {
      if (!isValibotSchema(value)) {
        continue;
      }
      const isRequired = this.isRequired(value, direction);
      if (isRequired) {
        required.push(name);
      }
      edges.push(
        this.createEdge({ relation: "property", name, required: isRequired }, value, direction),
      );
    }

    edges.push(
      isValibotSchema(rest)
        ? this.createEdge({ relation: "remaining-property" }, rest, direction)
        : this.createNodeEdge({ relation: "remaining-property" }, UNKNOWN_NODE),
    );

    annotations.required = required;
    annotations.unknownKeys = "catchall";
    return this.createKindNode("object", annotations as ObjectAnnotation, edges);
  }

  private buildRecord(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    this.applyPropertyValidations(annotations, this.validations(schema, direction));
    const key = (schema as { readonly key?: unknown }).key;
    const value = (schema as { readonly value?: unknown }).value;
    const edges: Edge[] = [
      isValibotSchema(key)
        ? this.createEdge({ relation: "property-name" }, key, direction)
        : this.createNodeEdge({ relation: "property-name" }, UNKNOWN_NODE),
      isValibotSchema(value)
        ? this.createEdge({ relation: "remaining-property" }, value, direction)
        : this.createNodeEdge({ relation: "remaining-property" }, UNKNOWN_NODE),
    ];
    annotations.record = true;
    return this.createKindNode("object", annotations as ObjectAnnotation, edges);
  }

  private buildMap(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    this.applySizeValidations(annotations, this.validations(schema, direction));
    const key = (schema as { readonly key?: unknown }).key;
    const value = (schema as { readonly value?: unknown }).value;
    const edges: Edge[] = [
      isValibotSchema(key)
        ? this.createEdge({ relation: "valibot:map-key" }, key, direction)
        : this.createNodeEdge({ relation: "valibot:map-key" }, UNKNOWN_NODE),
      isValibotSchema(value)
        ? this.createEdge({ relation: "valibot:map-value" }, value, direction)
        : this.createNodeEdge({ relation: "valibot:map-value" }, UNKNOWN_NODE),
    ];
    return this.createKindNode("valibot:map", annotations, edges);
  }

  private buildSet(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    this.applySizeValidations(annotations, this.validations(schema, direction));
    const value = (schema as { readonly value?: unknown }).value;
    const edges: Edge[] = [
      isValibotSchema(value)
        ? this.createEdge({ relation: "valibot:set-item" }, value, direction)
        : this.createNodeEdge({ relation: "valibot:set-item" }, UNKNOWN_NODE),
    ];
    return this.createKindNode("valibot:set", annotations as SetAnnotation, edges);
  }

  private buildUnion(
    schema: ValibotSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const options = (schema as { readonly options?: unknown }).options;
    const edges: Edge[] = [];
    for (const option of asSchemas(options)) {
      if (context !== undefined && this.matches(option, context.value) === false) {
        continue;
      }
      edges.push(this.createEdge({ relation: "any-of" }, option, direction));
    }
    return this.createKindNode("unknown", annotations, edges);
  }

  private buildVariant(
    schema: ValibotSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const key = (schema as { readonly key?: unknown }).key;
    if (typeof key === "string") {
      annotations.discriminator = key;
    }
    const options = (schema as { readonly options?: unknown }).options;
    const edges: Edge[] = [];
    for (const option of asSchemas(options)) {
      if (context !== undefined && this.matches(option, context.value) === false) {
        continue;
      }
      edges.push(this.createEdge({ relation: "one-of" }, option, direction));
    }
    return this.createKindNode("unknown", annotations, edges);
  }

  private buildIntersect(
    schema: ValibotSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const options = (schema as { readonly options?: unknown }).options;
    const edges: Edge[] = asSchemas(options).map((option) =>
      this.createEdge({ relation: "all-of" }, option, direction),
    );
    return this.createKindNode("unknown", annotations, edges);
  }

  private buildLiteral(schema: ValibotSchema, extra: Readonly<Record<string, unknown>>): Node {
    if (!Object.hasOwn(schema, "literal")) {
      return this.createKindNode("never", this.annotations(schema, extra));
    }
    return this.literalNode(schema, (schema as { readonly literal?: unknown }).literal, extra);
  }

  private buildValues(schema: ValibotSchema, extra: Readonly<Record<string, unknown>>): Node {
    const options = (schema as { readonly options?: unknown }).options;
    const values = Array.isArray(options) ? options : [];
    if (values.length === 0) {
      return this.createKindNode("never", this.annotations(schema, extra));
    }
    const edges = values.map((value) =>
      this.createNodeEdge({ relation: "one-of" }, this.literalNode(schema, value, {})),
    );
    return this.createKindNode("unknown", this.annotations(schema, extra), edges);
  }

  private buildFile(
    schema: ValibotSchema,
    kind: "valibot:file" | "valibot:blob",
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);

    for (const action of actionsOf(schema)) {
      if (action.kind === "transformation") {
        continue;
      }
      switch (action.type) {
        case "min_size":
          if (typeof action.requirement === "number") {
            annotations.minSize = action.requirement;
          }
          break;
        case "max_size":
          if (typeof action.requirement === "number") {
            annotations.maxSize = action.requirement;
          }
          break;
        case "size":
          if (typeof action.requirement === "number") {
            annotations.minSize = action.requirement;
            annotations.maxSize = action.requirement;
          }
          break;
        case "mime_type":
          if (Array.isArray(action.requirement)) {
            annotations.mime = action.requirement.filter(
              (value): value is string => typeof value === "string",
            );
          }
          break;
      }
    }

    return this.createKindNode(kind, annotations as FileAnnotation);
  }

  private buildInstance(schema: ValibotSchema, extra: Readonly<Record<string, unknown>>): Node {
    const annotations = this.annotations(schema, extra);
    const constructor = (schema as { readonly class?: unknown }).class;
    if (typeof constructor === "function" && typeof constructor.name === "string") {
      annotations.class = constructor.name;
    }
    return this.createKindNode("valibot:instance", annotations as InstanceAnnotation);
  }

  private buildNullable(
    schema: ValibotSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, { ...extra, nullable: true });
    const inner = this.wrappedOf(schema);
    const edges: Edge[] = [];
    if (context === undefined || this.matches(inner, context.value) !== false) {
      edges.push(this.createEdge({ relation: "any-of" }, inner, direction));
    }
    if (context === undefined || context.value === null) {
      edges.push(this.createNodeEdge({ relation: "any-of" }, NULL_NODE));
    }
    return this.createKindNode("unknown", annotations, edges);
  }

  private buildNullish(
    schema: ValibotSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, {
      ...extra,
      nullable: true,
      optional: true,
    });
    const inner = this.wrappedOf(schema);
    const edges: Edge[] = [];
    if (context === undefined || this.matches(inner, context.value) !== false) {
      edges.push(this.createEdge({ relation: "any-of" }, inner, direction));
    }
    if (context === undefined || context.value === null) {
      edges.push(this.createNodeEdge({ relation: "any-of" }, NULL_NODE));
    }
    if (context === undefined || context.value === undefined) {
      edges.push(this.createNodeEdge({ relation: "any-of" }, UNDEFINED_NODE));
    }
    return this.createKindNode("unknown", annotations, edges);
  }

  private buildUnwrapped(
    schema: ValibotSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
    wrappedTypes: ReadonlySet<string>,
    annotations: Readonly<Record<string, unknown>>,
  ): Node {
    let inner = this.wrappedOf(schema);
    while (wrappedTypes.has(inner.type)) {
      inner = this.wrappedOf(inner);
    }
    return this.build(inner, direction, context, { ...extra, ...annotations }, false);
  }

  private buildLazy(
    schema: ValibotSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    if (this.resolvingLazy.has(schema)) {
      return UNKNOWN_NODE;
    }
    this.resolvingLazy.add(schema);
    try {
      const getter = (schema as { readonly getter?: unknown }).getter;
      if (typeof getter !== "function") {
        return this.unsupported(schema, "lazy", direction, context, extra);
      }
      const cached = this.lazyInner.get(schema);
      const inner = cached ?? (getter as () => unknown)();
      if (!isValibotSchema(inner)) {
        return this.unsupported(schema, "lazy", direction, context, extra);
      }
      this.lazyInner.set(schema, inner);
      return this.build(inner, direction, context, extra, false);
    } finally {
      this.resolvingLazy.delete(schema);
    }
  }

  private unsupported(
    schema: ValibotSchema,
    type: string,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    if (this.onUnsupported === "throw") {
      throw new Error(`Unsupported Valibot schema type "${type}"`);
    }
    if (this.resolvingUnsupported.has(schema)) {
      return UNKNOWN_NODE;
    }
    this.resolvingUnsupported.add(schema);
    try {
      const replacement = this.onUnsupported(schema, type);
      if (replacement === undefined) {
        return this.createKindNode("unknown", this.annotations(schema, { ...extra, type }));
      }
      return this.build(replacement, direction, context, extra, false);
    } finally {
      this.resolvingUnsupported.delete(schema);
    }
  }

  private wrappedOf(schema: ValibotSchema): ValibotSchema {
    const wrapped = (schema as { readonly wrapped?: unknown }).wrapped;
    return isValibotSchema(wrapped) ? wrapped : schema;
  }

  private defaultOf(schema: ValibotSchema): unknown {
    const value = (schema as { readonly default?: unknown }).default;
    return typeof value === "function" ? (value as () => unknown)() : value;
  }

  private withDefault(
    schema: ValibotSchema,
    extra: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    const value = this.defaultOf(schema);
    return value === undefined ? extra : { ...extra, default: value };
  }

  private remainingProperty(
    unknownKeys: ObjectAnnotation["unknownKeys"],
    direction: Direction,
  ): Node {
    switch (unknownKeys) {
      case "strict":
        return NEVER_NODE;
      case "loose":
        return ANY_NODE;
      default:
        return direction === "input" ? ANY_NODE : NEVER_NODE;
    }
  }

  private isRequired(entry: ValibotSchema, direction: Direction): boolean {
    const type = entry.type;
    const optionalType = type === "optional" || type === "exact_optional" || type === "nullish";
    if (direction === "input") {
      return !optionalType;
    }
    return optionalType ? this.defaultOf(entry) !== undefined : true;
  }

  private hasOutputTransformation(schema: ValibotSchema): boolean {
    return actionsOf(schema).some(
      (action) =>
        action.kind === "transformation" &&
        typeof action.type === "string" &&
        !SHAPE_PRESERVING_TRANSFORMATIONS.has(action.type),
    );
  }

  private validations(
    schema: ValibotSchema,
    direction: Direction,
  ): readonly ValibotActionDefinition[] {
    const result: ValibotActionDefinition[] = [];
    for (const action of actionsOf(schema)) {
      if (action.kind === "transformation") {
        if (typeof action.type === "string" && SHAPE_PRESERVING_TRANSFORMATIONS.has(action.type)) {
          continue;
        }
        if (direction === "input") {
          break;
        }
        return [];
      }
      if (action.kind === "validation") {
        result.push(action);
      }
    }
    return result;
  }

  private applyLengthValidations(
    annotations: Record<string, unknown>,
    validations: readonly ValibotActionDefinition[],
  ): void {
    for (const action of validations) {
      switch (action.type) {
        case "min_length":
          if (typeof action.requirement === "number") {
            annotations.minItems = action.requirement;
          }
          break;
        case "max_length":
          if (typeof action.requirement === "number") {
            annotations.maxItems = action.requirement;
          }
          break;
        case "length":
          if (typeof action.requirement === "number") {
            annotations.minItems = action.requirement;
            annotations.maxItems = action.requirement;
          }
          break;
        case "non_empty":
          if (annotations.minItems === undefined) {
            annotations.minItems = 1;
          }
          break;
        case "empty":
          annotations.minItems = 0;
          annotations.maxItems = 0;
          break;
      }
    }
  }

  private applyPropertyValidations(
    annotations: Record<string, unknown>,
    validations: readonly ValibotActionDefinition[],
  ): void {
    for (const action of validations) {
      switch (action.type) {
        case "min_entries":
          if (typeof action.requirement === "number") {
            annotations.minProperties = action.requirement;
          }
          break;
        case "max_entries":
          if (typeof action.requirement === "number") {
            annotations.maxProperties = action.requirement;
          }
          break;
        case "entries":
          if (typeof action.requirement === "number") {
            annotations.minProperties = action.requirement;
            annotations.maxProperties = action.requirement;
          }
          break;
        case "non_empty":
          if (annotations.minProperties === undefined) {
            annotations.minProperties = 1;
          }
          break;
        case "empty":
          annotations.minProperties = 0;
          annotations.maxProperties = 0;
          break;
      }
    }
  }

  private applySizeValidations(
    annotations: Record<string, unknown>,
    validations: readonly ValibotActionDefinition[],
  ): void {
    for (const action of validations) {
      switch (action.type) {
        case "min_size":
          if (typeof action.requirement === "number") {
            annotations.minSize = action.requirement;
          }
          break;
        case "max_size":
          if (typeof action.requirement === "number") {
            annotations.maxSize = action.requirement;
          }
          break;
        case "size":
          if (typeof action.requirement === "number") {
            annotations.minSize = action.requirement;
            annotations.maxSize = action.requirement;
          }
          break;
      }
    }
  }

  private matches(schema: ValibotSchema, value: unknown): boolean | undefined {
    try {
      const standard = (
        schema as {
          readonly "~standard"?: { readonly validate?: unknown };
        }
      )["~standard"];
      const validate = standard?.validate;
      if (typeof validate !== "function") {
        return undefined;
      }
      const result = (validate as (value: unknown) => unknown).call(standard, value);
      if (result === null || typeof result !== "object") {
        return undefined;
      }
      if (typeof (result as { readonly then?: unknown }).then === "function") {
        return undefined;
      }
      return "issues" in result ? false : true;
    } catch {
      return undefined;
    }
  }

  private literalNode(
    schema: ValibotSchema,
    value: unknown,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    annotations.const = value;
    return this.createKindNode(this.kindOfValue(value), annotations);
  }

  private kindOfValue(value: unknown): keyof AnnotationMap & string {
    if (value === null) {
      return "null";
    }
    if (Array.isArray(value)) {
      return "array";
    }
    switch (typeof value) {
      case "bigint":
        return "valibot:bigint";
      case "boolean":
        return "boolean";
      case "number":
        return Number.isNaN(value) ? "valibot:nan" : Number.isInteger(value) ? "integer" : "number";
      case "object":
        return value instanceof Date ? "valibot:date" : "object";
      case "string":
        return "string";
      case "symbol":
        return "valibot:symbol";
      case "undefined":
        return "valibot:undefined";
      default:
        return "unknown";
    }
  }

  private annotations(
    schema: ValibotSchema,
    extra: Readonly<Record<string, unknown>>,
  ): Record<string, unknown> {
    const annotations: Record<string, unknown> = {};
    const brands: string[] = [];

    for (const action of actionsOf(schema)) {
      if (action.kind === "metadata") {
        switch (action.type) {
          case "title":
            if (typeof action.title === "string") {
              annotations.title = action.title;
            }
            break;
          case "description":
            if (typeof action.description === "string") {
              annotations.description = action.description;
            }
            break;
          case "examples":
            if (Array.isArray(action.examples)) {
              annotations.examples = action.examples;
            }
            break;
          case "metadata":
            if (isRecord(action.metadata)) {
              annotations.metadata = action.metadata;
            }
            break;
        }
      } else if (action.kind === "validation") {
        switch (action.type) {
          case "value":
            annotations.const = action.requirement;
            break;
          case "values":
            if (Array.isArray(action.requirement)) {
              annotations.values = action.requirement;
            }
            break;
          case "not_value":
            annotations.notValues = [action.requirement];
            break;
          case "not_values":
            if (Array.isArray(action.requirement)) {
              annotations.notValues = action.requirement;
            }
            break;
        }
      } else if (action.kind === "transformation") {
        if (action.type === "brand" && typeof action.name === "string") {
          brands.push(action.name);
        } else if (action.type === "readonly") {
          annotations.readOnly = true;
        }
      }
    }

    if (Object.hasOwn(schema, "fallback")) {
      annotations.fallback = true;
    }
    if (brands.length > 0) {
      annotations.brands = brands;
    }
    return { ...annotations, ...extra };
  }

  private createEdge(relation: Relation, child: ValibotSchema, direction: Direction): Edge {
    return {
      ...relation,
      node: (context?: Context): Node => this.build(child, direction, context, {}),
    } as Edge;
  }

  private createNodeEdge(relation: Relation, node: Node): Edge {
    return { ...relation, node: (): Node => node } as Edge;
  }

  private createKindNode(
    kind: keyof AnnotationMap & string,
    annotations: object,
    edges: readonly Edge[] = NO_EDGES,
  ): Node {
    return { kind, annotations, edges } as Node;
  }
}

export function toSchemaIntrospection(
  schema: ValibotSchema,
  options: ValibotIntrospectionOptions = {},
): ValibotIntrospection {
  const introspector = new Introspector(schema, options);
  return {
    "~introspection": {
      version: 1,
      vendor: VALIBOT_VENDOR,
      introspect: (introspectionOptions: SchemaIntrospectionV1.Options): ValibotNode =>
        introspector.introspect(introspectionOptions),
    },
  };
}
