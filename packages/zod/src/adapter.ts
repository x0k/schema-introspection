import type { SchemaIntrospectionV1 } from "@schema-introspection/spec";

import type {
  AnnotationMap,
  ArrayAnnotation,
  BigIntAnnotation,
  DateAnnotation,
  FileAnnotation,
  NumberAnnotation,
  ObjectAnnotation,
  SetAnnotation,
  StringAnnotation,
} from "./annotations.ts";
import type { Relation } from "./relations.ts";
import {
  checksOf,
  definitionOf,
  definitionType,
  isZodSchema,
  type ZodCheckDefinition,
  type ZodSchema,
} from "./schema.ts";

type Node = SchemaIntrospectionV1.Node<AnnotationMap, Relation>;

type Edge = SchemaIntrospectionV1.Edge<AnnotationMap, Relation>;

type Context = SchemaIntrospectionV1.Context;

type Direction = SchemaIntrospectionV1.Direction;

const NO_EDGES: readonly Edge[] = [];

const ANY_NODE: Node = { kind: "any", annotations: {}, edges: NO_EDGES };

const NEVER_NODE: Node = { kind: "never", annotations: {}, edges: NO_EDGES };

const NULL_NODE: Node = { kind: "null", annotations: {}, edges: NO_EDGES };

const UNKNOWN_NODE: Node = { kind: "unknown", annotations: {}, edges: NO_EDGES };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asSchemas(value: unknown): readonly ZodSchema[] {
  return Array.isArray(value) ? value.filter(isZodSchema) : [];
}

/**
 * Provides a schema to use when a definition is not recognized. Returning
 * `undefined` produces an `unknown` node annotated with the type. Returning a
 * schema that reproduces the same unsupported type recurses until the
 * adapter's cycle handling stops it.
 */
export interface ZodUnsupportedHandler {
  (schema: ZodSchema, type: string): ZodSchema | undefined;
}

export type ZodUnsupported = "throw" | ZodUnsupportedHandler;

export interface ZodAdapterOptions {
  /** How schemas with an unrecognized definition are handled; defaults to `"throw"`. */
  readonly onUnsupported?: ZodUnsupported;
}

export type ZodNode = SchemaIntrospectionV1.Node<AnnotationMap, Relation>;

export type ZodEdge = SchemaIntrospectionV1.Edge<AnnotationMap, Relation>;

export interface ZodIntrospection extends SchemaIntrospectionV1<AnnotationMap, Relation> {}

export const ZOD_VENDOR: string = "zod";

class Introspector {
  private readonly root: ZodSchema;
  private readonly onUnsupported: ZodUnsupported;
  private readonly cache: Map<ZodSchema, Map<Direction, Node>> = new Map();
  private readonly resolvingLazy: Set<ZodSchema> = new Set();
  private readonly resolvingUnsupported: Set<ZodSchema> = new Set();

  constructor(schema: ZodSchema, options: ZodAdapterOptions) {
    this.root = schema;
    this.onUnsupported = options.onUnsupported ?? "throw";
  }

  introspect(options: SchemaIntrospectionV1.Options): ZodNode {
    return this.build(this.root, options.direction, options.context, {});
  }

  private build(
    schema: ZodSchema,
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

  private getCached(schema: ZodSchema, direction: Direction): Node | undefined {
    return this.cache.get(schema)?.get(direction);
  }

  private setCached(schema: ZodSchema, direction: Direction, node: Node): void {
    let byDirection = this.cache.get(schema);
    if (byDirection === undefined) {
      byDirection = new Map();
      this.cache.set(schema, byDirection);
    }
    byDirection.set(direction, node);
  }

  private buildUncached(
    schema: ZodSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const definition = definitionOf(schema);
    switch (definition.type) {
      case "string":
        return this.buildString(schema, extra);
      case "number":
      case "int":
        return this.buildNumber(schema, extra);
      case "boolean":
        return this.createKindNode("boolean", this.annotations(schema, extra));
      case "bigint":
        return this.buildBigInt(schema, extra);
      case "symbol":
        return this.createKindNode("zod:symbol", this.annotations(schema, extra));
      case "undefined":
        return this.createKindNode("zod:undefined", this.annotations(schema, extra));
      case "void":
        return this.createKindNode("zod:void", this.annotations(schema, extra));
      case "null":
        return this.createKindNode("null", this.annotations(schema, extra));
      case "nan":
        return this.createKindNode("zod:nan", this.annotations(schema, extra));
      case "any":
      case "unknown":
        return this.createKindNode("any", this.annotations(schema, extra));
      case "never":
        return this.createKindNode("never", this.annotations(schema, extra));
      case "date":
        return this.buildDate(schema, extra);
      case "array":
        return this.buildArray(schema, direction, extra);
      case "tuple":
        return this.buildTuple(schema, direction, extra);
      case "object":
        return this.buildObject(schema, direction, extra);
      case "record":
        return this.buildRecord(schema, direction, extra);
      case "map":
        return this.buildMap(schema, direction, extra);
      case "set":
        return this.buildSet(schema, direction, extra);
      case "union":
        return this.buildUnion(schema, direction, context, extra);
      case "intersection":
        return this.buildIntersection(schema, direction, extra);
      case "literal":
        return this.buildLiteral(schema, extra);
      case "enum":
        return this.buildEnum(schema, extra);
      case "template_literal":
        return this.buildTemplateLiteral(schema, extra);
      case "file":
        return this.buildFile(schema, extra);
      case "function":
        return this.buildFunction(schema, direction, extra);
      case "promise":
        return this.buildPromise(schema, direction, extra);
      case "lazy":
        return this.buildLazy(schema, direction, context, extra);
      case "optional":
        return this.build(
          this.innerType(schema),
          direction,
          context,
          { ...extra, optional: true },
          false,
        );
      case "nullable":
        return this.buildNullable(schema, innerTypeOf(schema), direction, context, extra);
      case "default":
        return this.build(
          this.innerType(schema),
          direction,
          context,
          { ...extra, default: this.defaultValue(schema) },
          false,
        );
      case "prefault":
        return this.build(
          this.innerType(schema),
          direction,
          context,
          { ...extra, default: this.defaultValue(schema) },
          false,
        );
      case "catch":
        return this.build(
          this.innerType(schema),
          direction,
          context,
          { ...extra, catch: true },
          false,
        );
      case "readonly":
        return this.build(
          this.innerType(schema),
          direction,
          context,
          { ...extra, readOnly: true },
          false,
        );
      case "nonoptional":
        return this.buildNonOptional(schema, direction, context, extra);
      case "success":
        return this.buildSuccess(schema, direction, context, extra);
      case "pipe":
        return this.buildPipe(schema, direction, context, extra);
      case "transform":
        return this.createKindNode(
          direction === "input" ? "any" : "unknown",
          this.annotations(schema, { ...extra, transform: true }),
        );
      case "custom":
        return this.createKindNode("unknown", this.annotations(schema, { ...extra, custom: true }));
      default:
        return this.unsupported(schema, definition.type, direction, context, extra);
    }
  }

  private buildString(schema: ZodSchema, extra: Readonly<Record<string, unknown>>): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as {
      readonly coerce?: boolean;
      readonly format?: string;
    };
    if (definition.coerce === true) {
      annotations.coerce = true;
    }
    if (typeof definition.format === "string") {
      annotations.format = definition.format;
    }

    const patterns: string[] = [];
    const patternFlags: string[] = [];
    for (const check of checksOf(schema)) {
      switch (check.check) {
        case "min_length":
          if (typeof check.minimum === "number") {
            annotations.minLength = check.minimum;
          }
          break;
        case "max_length":
          if (typeof check.maximum === "number") {
            annotations.maxLength = check.maximum;
          }
          break;
        case "length_equals":
          if (typeof check.length === "number") {
            annotations.minLength = check.length;
            annotations.maxLength = check.length;
          }
          break;
        case "string_format":
          this.applyStringFormat(annotations, check, patterns, patternFlags);
          break;
        case "overwrite":
          annotations.overwrite = true;
          break;
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

  private applyStringFormat(
    annotations: Record<string, unknown>,
    check: ZodCheckDefinition,
    patterns: string[],
    patternFlags: string[],
  ): void {
    if (check.pattern instanceof RegExp) {
      patterns.push(check.pattern.source);
      patternFlags.push(check.pattern.flags);
    }
    switch (check.format) {
      case "regex":
        break;
      case "starts_with":
        if (typeof check.prefix === "string") {
          annotations.startsWith = check.prefix;
        }
        break;
      case "ends_with":
        if (typeof check.suffix === "string") {
          annotations.endsWith = check.suffix;
        }
        break;
      case "includes":
        if (typeof check.includes === "string") {
          annotations.includes = check.includes;
        }
        break;
      default:
        if (typeof check.format === "string") {
          annotations.format = check.format;
        }
    }
  }

  private buildNumber(schema: ZodSchema, extra: Readonly<Record<string, unknown>>): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as { readonly coerce?: boolean };
    if (definition.coerce === true) {
      annotations.coerce = true;
    }

    let integer = definitionOf(schema).type === "int";
    for (const check of checksOf(schema)) {
      switch (check.check) {
        case "number_format":
          if (check.format === "int32" || check.format === "uint32" || check.format === "safeint") {
            integer = true;
          }
          if (typeof check.format === "string") {
            annotations.format = check.format;
          }
          break;
        case "greater_than":
          if (typeof check.value === "number") {
            if (check.inclusive === true) {
              annotations.minimum = check.value;
            } else {
              annotations.exclusiveMinimum = check.value;
            }
          }
          break;
        case "less_than":
          if (typeof check.value === "number") {
            if (check.inclusive === true) {
              annotations.maximum = check.value;
            } else {
              annotations.exclusiveMaximum = check.value;
            }
          }
          break;
        case "multiple_of":
          if (typeof check.value === "number") {
            annotations.multipleOf = check.value;
          }
          break;
      }
    }

    return this.createKindNode(integer ? "integer" : "number", annotations as NumberAnnotation);
  }

  private buildBigInt(schema: ZodSchema, extra: Readonly<Record<string, unknown>>): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as {
      readonly coerce?: boolean;
      readonly format?: string;
    };
    if (definition.coerce === true) {
      annotations.coerce = true;
    }
    if (typeof definition.format === "string") {
      annotations.format = definition.format;
    }

    for (const check of checksOf(schema)) {
      switch (check.check) {
        case "greater_than":
          if (typeof check.value === "bigint") {
            if (check.inclusive === true) {
              annotations.minimum = check.value;
            }
          }
          break;
        case "less_than":
          if (typeof check.value === "bigint") {
            if (check.inclusive === true) {
              annotations.maximum = check.value;
            }
          }
          break;
        case "bigint_format":
          if (typeof check.format === "string") {
            annotations.format = check.format;
          }
          break;
      }
    }

    return this.createKindNode("zod:bigint", annotations as BigIntAnnotation);
  }

  private buildDate(schema: ZodSchema, extra: Readonly<Record<string, unknown>>): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as { readonly coerce?: boolean };
    if (definition.coerce === true) {
      annotations.coerce = true;
    }

    for (const check of checksOf(schema)) {
      switch (check.check) {
        case "greater_than":
          if (check.value instanceof Date && check.inclusive === true) {
            annotations.minimum = check.value;
          }
          break;
        case "less_than":
          if (check.value instanceof Date && check.inclusive === true) {
            annotations.maximum = check.value;
          }
          break;
      }
    }

    return this.createKindNode("zod:date", annotations as DateAnnotation);
  }

  private buildArray(
    schema: ZodSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    this.applyLengthChecks(annotations, checksOf(schema));
    const element = (definitionOf(schema) as unknown as { readonly element?: unknown }).element;
    const edges = [
      isZodSchema(element)
        ? this.createEdge({ relation: "items" }, element, direction)
        : this.createNodeEdge({ relation: "items" }, UNKNOWN_NODE),
    ];
    return this.createKindNode("array", annotations as ArrayAnnotation, edges);
  }

  private buildTuple(
    schema: ZodSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as {
      readonly items?: unknown;
      readonly rest?: unknown;
    };
    const edges: Edge[] = [];
    for (const [index, item] of asSchemas(definition.items).entries()) {
      edges.push(this.createEdge({ relation: "item", index }, item, direction));
    }
    edges.push(
      isZodSchema(definition.rest)
        ? this.createEdge({ relation: "items" }, definition.rest, direction)
        : this.createNodeEdge({ relation: "items" }, NEVER_NODE),
    );
    return this.createKindNode("array", annotations as ArrayAnnotation, edges);
  }

  private buildObject(
    schema: ZodSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as {
      readonly shape?: unknown;
      readonly catchall?: unknown;
    };
    const shape = isRecord(definition.shape) ? definition.shape : {};
    const catchall = isZodSchema(definition.catchall) ? definition.catchall : undefined;
    const required: string[] = [];
    const edges: Edge[] = [];

    for (const [name, value] of Object.entries(shape)) {
      if (!isZodSchema(value)) {
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

    if (catchall !== undefined) {
      edges.push(this.createEdge({ relation: "remaining-property" }, catchall, direction));
    } else {
      edges.push(
        this.createNodeEdge(
          { relation: "remaining-property" },
          direction === "input" ? ANY_NODE : NEVER_NODE,
        ),
      );
    }

    annotations.required = required;
    annotations.unknownKeys = this.unknownKeysOf(catchall);
    return this.createKindNode("object", annotations as ObjectAnnotation, edges);
  }

  private buildRecord(
    schema: ZodSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as {
      readonly keyType?: unknown;
      readonly valueType?: unknown;
      readonly mode?: unknown;
    };
    const edges: Edge[] = [
      isZodSchema(definition.keyType)
        ? this.createEdge({ relation: "property-name" }, definition.keyType, direction)
        : this.createNodeEdge({ relation: "property-name" }, UNKNOWN_NODE),
      isZodSchema(definition.valueType)
        ? this.createEdge({ relation: "remaining-property" }, definition.valueType, direction)
        : this.createNodeEdge({ relation: "remaining-property" }, UNKNOWN_NODE),
    ];
    annotations.record = true;
    if (definition.mode === "strict" || definition.mode === "loose") {
      annotations.recordMode = definition.mode;
    }
    return this.createKindNode("object", annotations as ObjectAnnotation, edges);
  }

  private buildMap(
    schema: ZodSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as {
      readonly keyType?: unknown;
      readonly valueType?: unknown;
    };
    const edges: Edge[] = [
      isZodSchema(definition.keyType)
        ? this.createEdge({ relation: "zod:map-key" }, definition.keyType, direction)
        : this.createNodeEdge({ relation: "zod:map-key" }, UNKNOWN_NODE),
      isZodSchema(definition.valueType)
        ? this.createEdge({ relation: "zod:map-value" }, definition.valueType, direction)
        : this.createNodeEdge({ relation: "zod:map-value" }, UNKNOWN_NODE),
    ];
    return this.createKindNode("zod:map", annotations, edges);
  }

  private buildSet(
    schema: ZodSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as { readonly valueType?: unknown };
    this.applySizeChecks(annotations, checksOf(schema));
    const edges: Edge[] = [
      isZodSchema(definition.valueType)
        ? this.createEdge({ relation: "zod:set-item" }, definition.valueType, direction)
        : this.createNodeEdge({ relation: "zod:set-item" }, UNKNOWN_NODE),
    ];
    return this.createKindNode("zod:set", annotations as SetAnnotation, edges);
  }

  private buildUnion(
    schema: ZodSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as {
      readonly options?: unknown;
      readonly inclusive?: boolean;
      readonly discriminator?: string;
    };
    if (typeof definition.discriminator === "string") {
      annotations.discriminator = definition.discriminator;
    }
    const relation: Relation =
      definition.inclusive === false ? { relation: "one-of" } : { relation: "any-of" };
    const edges: Edge[] = [];
    for (const option of asSchemas(definition.options)) {
      if (context !== undefined && this.matches(option, context.value) === false) {
        continue;
      }
      edges.push(this.createEdge(relation, option, direction));
    }
    return this.createKindNode("unknown", annotations, edges);
  }

  private buildIntersection(
    schema: ZodSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as {
      readonly left?: unknown;
      readonly right?: unknown;
    };
    const edges: Edge[] = [];
    for (const child of [definition.left, definition.right]) {
      if (isZodSchema(child)) {
        edges.push(this.createEdge({ relation: "all-of" }, child, direction));
      }
    }
    return this.createKindNode("unknown", annotations, edges);
  }

  private buildLiteral(schema: ZodSchema, extra: Readonly<Record<string, unknown>>): Node {
    const definition = definitionOf(schema) as unknown as { readonly values?: unknown };
    const values = Array.isArray(definition.values) ? definition.values : [];
    if (values.length === 0) {
      return this.createKindNode("never", this.annotations(schema, extra));
    }
    if (values.length === 1) {
      return this.literalNode(schema, values[0], extra);
    }
    const edges = values.map((value) =>
      this.createNodeEdge({ relation: "one-of" }, this.literalNode(schema, value, {})),
    );
    return this.createKindNode("unknown", this.annotations(schema, extra), edges);
  }

  private buildEnum(schema: ZodSchema, extra: Readonly<Record<string, unknown>>): Node {
    const definition = definitionOf(schema) as unknown as { readonly entries?: unknown };
    const values = isRecord(definition.entries) ? Object.values(definition.entries) : [];
    if (values.length === 0) {
      return this.createKindNode("never", this.annotations(schema, extra));
    }
    const edges = values.map((value) =>
      this.createNodeEdge({ relation: "one-of" }, this.literalNode(schema, value, {})),
    );
    return this.createKindNode("unknown", this.annotations(schema, extra), edges);
  }

  private buildTemplateLiteral(schema: ZodSchema, extra: Readonly<Record<string, unknown>>): Node {
    const annotations = this.annotations(schema, { ...extra, template: true });
    const pattern = schema._zod.pattern;
    if (pattern instanceof RegExp) {
      annotations.pattern = pattern.source;
      annotations.patternFlags = pattern.flags;
    }
    return this.createKindNode("string", annotations as StringAnnotation);
  }

  private buildFile(schema: ZodSchema, extra: Readonly<Record<string, unknown>>): Node {
    const annotations = this.annotations(schema, extra);
    for (const check of checksOf(schema)) {
      switch (check.check) {
        case "min_size":
          if (typeof check.minimum === "number") {
            annotations.minSize = check.minimum;
          }
          break;
        case "max_size":
          if (typeof check.maximum === "number") {
            annotations.maxSize = check.maximum;
          }
          break;
        case "mime_type":
          if (Array.isArray(check.mime)) {
            annotations.mime = check.mime;
          }
          break;
      }
    }
    return this.createKindNode("zod:file", annotations as FileAnnotation);
  }

  private buildFunction(
    schema: ZodSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as {
      readonly input?: unknown;
      readonly output?: unknown;
    };
    const edges: Edge[] = [];
    if (isZodSchema(definition.input)) {
      edges.push(this.createEdge({ relation: "zod:function-input" }, definition.input, direction));
    }
    if (isZodSchema(definition.output)) {
      edges.push(
        this.createEdge({ relation: "zod:function-output" }, definition.output, direction),
      );
    }
    return this.createKindNode("zod:function", annotations, edges);
  }

  private buildPromise(
    schema: ZodSchema,
    direction: Direction,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, extra);
    const definition = definitionOf(schema) as unknown as { readonly innerType?: unknown };
    const edges: Edge[] = [
      isZodSchema(definition.innerType)
        ? this.createEdge({ relation: "zod:promise-value" }, definition.innerType, direction)
        : this.createNodeEdge({ relation: "zod:promise-value" }, UNKNOWN_NODE),
    ];
    return this.createKindNode("zod:promise", annotations, edges);
  }

  private buildNullable(
    schema: ZodSchema,
    inner: ZodSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const annotations = this.annotations(schema, { ...extra, nullable: true });
    const innerEdge = this.createEdge({ relation: "any-of" }, inner, direction);
    const nullEdge = this.createNodeEdge({ relation: "any-of" }, NULL_NODE);
    const edges: Edge[] = [];
    if (context === undefined || this.matches(inner, context.value) !== false) {
      edges.push(innerEdge);
    }
    if (context === undefined || context.value === null) {
      edges.push(nullEdge);
    }
    return this.createKindNode("unknown", annotations, edges);
  }

  private buildNonOptional(
    schema: ZodSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    let inner = this.innerType(schema);
    while (definitionType(inner) === "optional") {
      inner = innerTypeOf(inner);
    }
    return this.build(inner, direction, context, { ...extra, optional: false }, false);
  }

  private buildSuccess(
    schema: ZodSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    if (direction === "input") {
      return this.build(this.innerType(schema), direction, context, extra, false);
    }
    return this.createKindNode("boolean", this.annotations(schema, extra));
  }

  private buildPipe(
    schema: ZodSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    const definition = definitionOf(schema) as unknown as {
      readonly in?: unknown;
      readonly out?: unknown;
    };
    const selected = direction === "input" ? definition.in : definition.out;
    if (!isZodSchema(selected)) {
      return this.unsupported(schema, definitionType(schema), direction, context, extra);
    }
    return this.build(selected, direction, context, extra, false);
  }

  private buildLazy(
    schema: ZodSchema,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    if (this.resolvingLazy.has(schema)) {
      return UNKNOWN_NODE;
    }
    this.resolvingLazy.add(schema);
    try {
      const getter = (definitionOf(schema) as unknown as { readonly getter?: unknown }).getter;
      if (typeof getter !== "function") {
        return this.unsupported(schema, "lazy", direction, context, extra);
      }
      const internals = schema._zod as unknown as { readonly innerType?: unknown };
      const cached = internals.innerType;
      const inner = cached === undefined ? (getter as () => unknown)() : cached;
      if (!isZodSchema(inner)) {
        return this.unsupported(schema, "lazy", direction, context, extra);
      }
      return this.build(inner, direction, context, extra, false);
    } finally {
      this.resolvingLazy.delete(schema);
    }
  }

  private unsupported(
    schema: ZodSchema,
    type: string,
    direction: Direction,
    context: Context | undefined,
    extra: Readonly<Record<string, unknown>>,
  ): Node {
    if (this.onUnsupported === "throw") {
      throw new Error(`Unsupported Zod schema type "${type}"`);
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

  private innerType(schema: ZodSchema): ZodSchema {
    const inner = (definitionOf(schema) as unknown as { readonly innerType?: unknown }).innerType;
    if (!isZodSchema(inner)) {
      return schema;
    }
    return inner;
  }

  private defaultValue(schema: ZodSchema): unknown {
    return (definitionOf(schema) as unknown as { readonly defaultValue?: unknown }).defaultValue;
  }

  private isRequired(schema: ZodSchema, direction: Direction): boolean {
    return direction === "input"
      ? schema._zod.optin === undefined
      : schema._zod.optout !== "optional";
  }

  private unknownKeysOf(catchall: ZodSchema | undefined): ObjectAnnotation["unknownKeys"] {
    if (catchall === undefined) {
      return "strip";
    }
    const type = definitionType(catchall);
    if (type === "never") {
      return "strict";
    }
    if (type === "unknown" || type === "any") {
      return "loose";
    }
    return "catchall";
  }

  private applyLengthChecks(
    annotations: Record<string, unknown>,
    checks: readonly ZodCheckDefinition[],
  ): void {
    for (const check of checks) {
      switch (check.check) {
        case "min_length":
          if (typeof check.minimum === "number") {
            annotations.minItems = check.minimum;
          }
          break;
        case "max_length":
          if (typeof check.maximum === "number") {
            annotations.maxItems = check.maximum;
          }
          break;
        case "length_equals":
          if (typeof check.length === "number") {
            annotations.minItems = check.length;
            annotations.maxItems = check.length;
          }
          break;
      }
    }
  }

  private applySizeChecks(
    annotations: Record<string, unknown>,
    checks: readonly ZodCheckDefinition[],
  ): void {
    for (const check of checks) {
      switch (check.check) {
        case "min_size":
          if (typeof check.minimum === "number") {
            annotations.minSize = check.minimum;
          }
          break;
        case "max_size":
          if (typeof check.maximum === "number") {
            annotations.maxSize = check.maximum;
          }
          break;
        case "size_equals":
          if (typeof check.size === "number") {
            annotations.minSize = check.size;
            annotations.maxSize = check.size;
          }
          break;
      }
    }
  }

  private matches(schema: ZodSchema, value: unknown): boolean | undefined {
    try {
      return schema.safeParse(value).success;
    } catch {
      return undefined;
    }
  }

  private literalNode(
    schema: ZodSchema,
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
        return "zod:bigint";
      case "boolean":
        return "boolean";
      case "number":
        return Number.isNaN(value) ? "zod:nan" : Number.isInteger(value) ? "integer" : "number";
      case "object":
        return value instanceof Date ? "zod:date" : "object";
      case "string":
        return "string";
      case "symbol":
        return "zod:symbol";
      case "undefined":
        return "zod:undefined";
      default:
        return "unknown";
    }
  }

  private annotations(
    schema: ZodSchema,
    extra: Readonly<Record<string, unknown>>,
  ): Record<string, unknown> {
    const annotations: Record<string, unknown> = {};
    const meta = this.metaOf(schema);
    if (meta !== undefined) {
      if (typeof meta.id === "string") {
        annotations.id = meta.id;
      }
      if (typeof meta.title === "string") {
        annotations.title = meta.title;
      }
      if (typeof meta.description === "string") {
        annotations.description = meta.description;
      }
      if (typeof meta.deprecated === "boolean") {
        annotations.deprecated = meta.deprecated;
      }
      if (meta.examples !== undefined) {
        annotations.examples = meta.examples;
      }
    }
    if (typeof schema.description === "string" && annotations.description === undefined) {
      annotations.description = schema.description;
    }
    return { ...annotations, ...extra };
  }

  private metaOf(schema: ZodSchema): Readonly<Record<string, unknown>> | undefined {
    try {
      const meta = schema.meta();
      return isRecord(meta) ? meta : undefined;
    } catch {
      return undefined;
    }
  }

  private createEdge(relation: Relation, child: ZodSchema, direction: Direction): Edge {
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

function innerTypeOf(schema: ZodSchema): ZodSchema {
  const inner = (definitionOf(schema) as unknown as { readonly innerType?: unknown }).innerType;
  return isZodSchema(inner) ? inner : schema;
}

export function adapter(schema: ZodSchema, options: ZodAdapterOptions = {}): ZodIntrospection {
  const introspector = new Introspector(schema, options);
  return {
    "~introspection": {
      version: 1,
      vendor: ZOD_VENDOR,
      introspect: (introspectionOptions: SchemaIntrospectionV1.Options): ZodNode =>
        introspector.introspect(introspectionOptions),
    },
  };
}
