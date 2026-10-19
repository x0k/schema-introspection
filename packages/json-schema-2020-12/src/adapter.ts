import type { SchemaIntrospectionV1 } from "@schema-introspection/spec";

import type { AnnotationMap, JsonSchemaAnnotation, UnknownAnnotation } from "./annotations.ts";
import { jsonEqual, matchesJsonSchema } from "./matches.ts";
import { isRecord } from "./object.ts";
import type { Relation } from "./relations.ts";
import { SchemaResolver } from "./resolver.ts";
import {
  isJsonSchema,
  isJsonSchemaTypeName,
  isSchemaObject,
  type JsonSchema,
  type JsonSchemaObject,
  type JsonSchemaTypeName,
} from "./schema.ts";
import { resolveUri } from "./uri.ts";

type Context = SchemaIntrospectionV1.Context;
type Node = SchemaIntrospectionV1.Node<AnnotationMap, Relation>;
type Edge = SchemaIntrospectionV1.Edge<AnnotationMap, Relation>;
type NodeKind = keyof AnnotationMap;
type Family = "array" | "number" | "object" | "string";

interface Part {
  readonly create: (context?: Context) => Node;
}

const NO_EDGES: readonly Edge[] = Object.freeze([]);

const ANY_NODE: Node = Object.freeze({
  kind: "any",
  annotations: Object.freeze({}),
  edges: NO_EDGES,
});

const NEVER_NODE: Node = Object.freeze({
  kind: "never",
  annotations: Object.freeze({}),
  edges: NO_EDGES,
});

const VALIDATION_KEYWORDS: ReadonlySet<string> = new Set([
  "type",
  "const",
  "enum",
  "multipleOf",
  "maximum",
  "exclusiveMaximum",
  "minimum",
  "exclusiveMinimum",
  "maxLength",
  "minLength",
  "pattern",
  "format",
  "contentEncoding",
  "contentMediaType",
  "contentSchema",
  "items",
  "prefixItems",
  "contains",
  "maxContains",
  "minContains",
  "maxItems",
  "minItems",
  "uniqueItems",
  "unevaluatedItems",
  "maxProperties",
  "minProperties",
  "required",
  "properties",
  "patternProperties",
  "additionalProperties",
  "propertyNames",
  "dependentRequired",
  "dependentSchemas",
  "dependencies",
  "unevaluatedProperties",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
]);

function asSchema(value: unknown): JsonSchema {
  return isJsonSchema(value) ? value : true;
}

/** Resolution state available to validators and mergers. */
export interface ResolutionContext {
  /** The root schema passed to the adapter. */
  readonly rootSchema: JsonSchema;
  /** Effective base URI of the root schema. */
  readonly rootBaseUri: string;
  /** Base URI of the schema currently being processed. */
  readonly baseUri: string;
  /** Additional schema documents, keyed by their retrieval URI. */
  readonly documents: Readonly<Record<string, JsonSchema>>;
}

/** Resolves whether a value matches a schema, e.g. by wrapping Ajv. */
export interface Validator {
  isValid(context: ResolutionContext, schemaDefinition: JsonSchema, value: unknown): boolean;
}

/** Merges `allOf` into a schema, e.g. by wrapping a merge library. */
export interface Merger {
  mergeAllOf(context: ResolutionContext, schema: JsonSchema): JsonSchema;
}

export type JsonSchema202012Validator = Validator;

export type JsonSchema202012Merger = Merger;

/**
 * Provides a schema to use when a reference cannot be resolved. Returning
 * `undefined` produces an `unknown` node annotated with the unresolved
 * reference. Returning a schema that reproduces the same unresolved reference
 * recurses until the adapter's cycle handling stops it.
 */
export interface JsonSchema202012UnresolvedReferenceHandler {
  (reference: string, context: ResolutionContext): JsonSchema | undefined;
}

export type JsonSchema202012UnresolvedReference =
  | "throw"
  | JsonSchema202012UnresolvedReferenceHandler;

export interface JsonSchema202012IntrospectionOptions {
  /** Retrieval URI for the root schema. */
  readonly baseUri?: string;
  /** Additional schema documents, keyed by their retrieval URI. */
  readonly documents?: Readonly<Record<string, JsonSchema>>;
  /** Used to resolve conditional and combinator edges in a context. */
  readonly validator?: Validator;
  /** When provided, schemas are merged before they are introspected. */
  readonly merger?: Merger;
  /** How unresolved references are handled; defaults to `"throw"`. */
  readonly onUnresolvedReference?: JsonSchema202012UnresolvedReference;
}

export type JsonSchema202012Node = SchemaIntrospectionV1.Node<AnnotationMap, Relation>;

export type JsonSchema202012Edge = SchemaIntrospectionV1.Edge<AnnotationMap, Relation>;

export interface JsonSchema202012Introspection extends SchemaIntrospectionV1<
  AnnotationMap,
  Relation
> {}

export const JSON_SCHEMA_2020_12_VENDOR: string = "json-schema-2020-12";

class Introspector {
  private readonly resolver: SchemaResolver;
  private readonly validator: Validator | undefined;
  private readonly merger: Merger | undefined;
  private readonly documents: Readonly<Record<string, JsonSchema>>;
  private readonly onUnresolvedReference: JsonSchema202012UnresolvedReference;
  private readonly resolvingUnresolved: Set<JsonSchemaObject> = new Set();
  private readonly cache: Map<JsonSchema, Map<string, Node>> = new Map();
  private readonly mergedSchemas: WeakMap<object, Map<string, JsonSchema>> = new WeakMap();
  private readonly mergedResults: WeakMap<object, Set<string>> = new WeakMap();

  constructor(schema: JsonSchema, options: JsonSchema202012IntrospectionOptions) {
    this.resolver = new SchemaResolver(schema, options);
    this.validator = options.validator;
    this.merger = options.merger;
    this.documents = options.documents ?? {};
    this.onUnresolvedReference = options.onUnresolvedReference ?? "throw";
  }

  introspect(options: SchemaIntrospectionV1.Options): JsonSchema202012Node {
    return this.build(this.resolver.root, this.resolver.base, options.context);
  }

  private build(schema: JsonSchema, base: string, context?: Context): JsonSchema202012Node {
    if (schema === true) {
      return ANY_NODE;
    }
    if (schema === false) {
      return NEVER_NODE;
    }

    const cacheable = context === undefined;
    const cached = cacheable ? this.getCached(schema, base) : undefined;
    if (cached !== undefined) {
      return cached;
    }

    if (isSchemaObject(schema)) {
      const merged = this.mergeAllOf(schema, base);
      if (merged !== schema) {
        const node = this.build(merged, base, context);
        if (cacheable) {
          this.setCached(schema, base, node);
        }
        return node;
      }
    }

    let node: JsonSchema202012Node;
    const reference = isSchemaObject(schema) ? this.referenceOf(schema) : undefined;
    if (isSchemaObject(schema) && reference !== undefined) {
      const resolved = this.resolveReference(schema, base);
      if (resolved !== undefined) {
        node = this.buildReference(schema, resolved.schema, resolved.base, base, context);
      } else if (this.resolvingUnresolved.has(schema)) {
        node = this.createKindNode("unknown", this.annotations(schema, "unknown"));
      } else {
        this.resolvingUnresolved.add(schema);
        try {
          const target = this.unresolvedTarget(reference, base);
          node =
            target === undefined
              ? this.createKindNode("unknown", this.annotations(schema, "unknown"))
              : this.buildReference(schema, target, this.childBase(target, base), base, context);
        } finally {
          this.resolvingUnresolved.delete(schema);
        }
      }
    } else {
      node = this.createNode(schema, base, context);
    }

    if (cacheable) {
      this.setCached(schema, base, node);
    }
    return node;
  }

  private getCached(schema: JsonSchema, base: string): Node | undefined {
    return this.cache.get(schema)?.get(base);
  }

  private setCached(schema: JsonSchema, base: string, node: Node): void {
    let byBase = this.cache.get(schema);
    if (byBase === undefined) {
      byBase = new Map();
      this.cache.set(schema, byBase);
    }
    byBase.set(base, node);
  }

  private resolutionContext(base: string): ResolutionContext {
    return {
      rootSchema: this.resolver.root,
      rootBaseUri: this.resolver.base,
      baseUri: base,
      documents: this.documents,
    };
  }

  private mergeAllOf(schema: JsonSchemaObject, base: string): JsonSchema {
    if (this.merger === undefined || this.mergedResults.get(schema)?.has(base) === true) {
      return schema;
    }

    const cached = this.mergedSchemas.get(schema)?.get(base);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const merged = this.merger.mergeAllOf(this.resolutionContext(base), schema);
      if (!isJsonSchema(merged)) {
        this.setMergedSchema(schema, base, schema);
        return schema;
      }
      if (isSchemaObject(merged)) {
        let bases = this.mergedResults.get(merged);
        if (bases === undefined) {
          bases = new Set();
          this.mergedResults.set(merged, bases);
        }
        bases.add(base);
      }
      this.setMergedSchema(schema, base, merged);
      return merged;
    } catch {
      this.setMergedSchema(schema, base, schema);
      return schema;
    }
  }

  private setMergedSchema(schema: object, base: string, merged: JsonSchema): void {
    let byBase = this.mergedSchemas.get(schema);
    if (byBase === undefined) {
      byBase = new Map();
      this.mergedSchemas.set(schema, byBase);
    }
    byBase.set(base, merged);
  }

  private isValid(schema: JsonSchema, base: string, value: unknown): boolean {
    if (this.validator !== undefined) {
      try {
        return this.validator.isValid(this.resolutionContext(base), schema, value);
      } catch {
        return matchesJsonSchema(schema, value, base, this.resolver);
      }
    }
    return matchesJsonSchema(schema, value, base, this.resolver);
  }

  private referenceOf(schema: JsonSchemaObject): string | undefined {
    if (typeof schema.$ref === "string") {
      return schema.$ref;
    }
    return typeof schema.$dynamicRef === "string" ? schema.$dynamicRef : undefined;
  }

  private siblingSchema(schema: JsonSchemaObject): JsonSchemaObject | undefined {
    for (const keyword of VALIDATION_KEYWORDS) {
      if (Object.hasOwn(schema, keyword)) {
        const sibling: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(schema)) {
          if (key !== "$ref" && key !== "$dynamicRef") {
            sibling[key] = value;
          }
        }
        return sibling as JsonSchemaObject;
      }
    }
    return undefined;
  }

  private resolveReference(
    schema: JsonSchemaObject,
    base: string,
  ): { readonly schema: JsonSchema; readonly base: string } | undefined {
    const seen: Set<JsonSchemaObject> = new Set();
    let currentSchema: JsonSchema = schema;
    let currentBase = base;

    while (isSchemaObject(currentSchema) && this.referenceOf(currentSchema) !== undefined) {
      if (seen.has(currentSchema)) {
        return { schema: true, base: currentBase };
      }
      seen.add(currentSchema);

      const reference = this.referenceOf(currentSchema);
      if (reference === undefined) {
        break;
      }
      const resolved = this.resolver.resolve(reference, currentBase);
      if (resolved === undefined) {
        return undefined;
      }
      currentSchema = resolved.schema;
      currentBase = resolved.base;
    }

    return { schema: currentSchema, base: currentBase };
  }

  private unresolvedTarget(reference: string, base: string): JsonSchema | undefined {
    if (this.onUnresolvedReference === "throw") {
      throw new Error(`Cannot resolve reference "${reference}" from "${base}"`);
    }
    return this.onUnresolvedReference(reference, this.resolutionContext(base));
  }

  private buildReference(
    schema: JsonSchemaObject,
    target: JsonSchema,
    targetBase: string,
    base: string,
    context?: Context,
  ): JsonSchema202012Node {
    const sibling = this.siblingSchema(schema);
    if (sibling === undefined) {
      return this.withReferenceAnnotations(schema, this.build(target, targetBase, context));
    }
    return this.createKindNode("unknown", this.annotations(schema, "unknown"), [
      this.createEdge({ relation: "all-of" }, (edgeContext?: Context): Node =>
        this.build(target, targetBase, edgeContext),
      ),
      this.createEdge({ relation: "all-of" }, (edgeContext?: Context): Node =>
        this.createNode(sibling, base, edgeContext),
      ),
    ]);
  }

  private createNode(
    schema: JsonSchemaObject,
    base: string,
    context?: Context,
  ): JsonSchema202012Node {
    const types = this.typeNames(schema);
    const explicitType = schema.type !== undefined;
    const families = this.inferredFamilies(schema);
    const hasConst = Object.hasOwn(schema, "const");

    let structuralKind: NodeKind | undefined;
    if (types.length === 1) {
      structuralKind = types[0];
    } else if (types.length === 0) {
      if (hasConst) {
        structuralKind = this.kindOfValue(schema.const);
      } else if (explicitType) {
        structuralKind = "unknown";
      } else if (families.length === 1) {
        structuralKind = families[0];
      } else if (families.length > 1) {
        structuralKind = "unknown";
      }
    }

    const includeStructure =
      types.length === 1 ||
      (types.length === 0 && (explicitType || hasConst || families.length > 0));

    const parts: Part[] = [];

    if (types.length > 1) {
      parts.push({
        create: (partContext?: Context): Node =>
          this.buildTypeUnion(schema, base, types, partContext),
      });
      if (hasConst) {
        parts.push({
          create: (): Node => this.buildConst(schema.const, this.annotations(schema, "any")),
        });
      }
    }

    if (schema.enum !== undefined && Array.isArray(schema.enum)) {
      parts.push({
        create: (partContext?: Context): Node => this.buildEnum(schema, base, partContext),
      });
    }

    if (schema.allOf !== undefined && Array.isArray(schema.allOf)) {
      parts.push({
        create: (partContext?: Context): Node =>
          this.buildArrayCombinator(schema, base, "allOf", { relation: "all-of" }, partContext),
      });
    }

    if (schema.anyOf !== undefined && Array.isArray(schema.anyOf)) {
      parts.push({
        create: (partContext?: Context): Node =>
          this.buildArrayCombinator(schema, base, "anyOf", { relation: "any-of" }, partContext),
      });
    }

    if (schema.oneOf !== undefined && Array.isArray(schema.oneOf)) {
      parts.push({
        create: (partContext?: Context): Node =>
          this.buildArrayCombinator(schema, base, "oneOf", { relation: "one-of" }, partContext),
      });
    }

    if (schema.not !== undefined) {
      parts.push({
        create: (): Node => this.buildNot(schema, base),
      });
    }

    if (schema.if !== undefined) {
      parts.push({
        create: (partContext?: Context): Node => this.buildIf(schema, base, partContext),
      });
    }

    if (this.hasDependencies(schema)) {
      parts.push({
        create: (partContext?: Context): Node => this.buildDependencies(schema, base, partContext),
      });
    }

    if (parts.length === 0) {
      if (includeStructure && structuralKind !== undefined) {
        return this.buildStructural(schema, base, structuralKind);
      }
      return this.createKindNode("any", this.annotations(schema, "any"));
    }

    if (parts.length === 1 && !includeStructure) {
      return parts[0].create(context);
    }

    const edges: Edge[] = [];

    if (includeStructure && structuralKind !== undefined) {
      edges.push(
        this.createEdge({ relation: "all-of" }, (): Node =>
          this.buildStructural(schema, base, structuralKind),
        ),
      );
    }

    for (const part of parts) {
      edges.push(this.createEdge({ relation: "all-of" }, part.create));
    }

    return this.createKindNode("unknown", this.annotations(schema, "unknown"), edges);
  }

  private buildStructural(
    schema: JsonSchemaObject,
    base: string,
    kind: NodeKind,
  ): JsonSchema202012Node {
    const edges: Edge[] = [];

    if (kind === "object") {
      this.addObjectEdges(schema, base, edges);
    } else if (kind === "array") {
      this.addArrayEdges(schema, base, edges);
    } else if (kind === "unknown") {
      if (this.hasObjectKeywords(schema)) {
        this.addObjectEdges(schema, base, edges);
      }
      if (this.hasArrayKeywords(schema)) {
        this.addArrayEdges(schema, base, edges);
      }
    }

    return this.createKindNode(
      kind,
      this.annotations(schema, kind),
      edges.length === 0 ? undefined : edges,
    );
  }

  private addObjectEdges(schema: JsonSchemaObject, base: string, edges: Edge[]): void {
    const required = new Set(
      Array.isArray(schema.required)
        ? schema.required.filter((name): name is string => typeof name === "string")
        : [],
    );
    const properties = isRecord(schema.properties) ? schema.properties : undefined;

    if (properties !== undefined) {
      for (const [name, value] of Object.entries(properties)) {
        if (!isJsonSchema(value)) {
          continue;
        }
        const childBase = this.childBase(value, base);
        edges.push(
          this.createEdge(
            { relation: "property", name, required: required.has(name) },
            (context?: Context): Node => this.build(value, childBase, context),
          ),
        );
      }
    }

    for (const name of required) {
      if (properties !== undefined && Object.hasOwn(properties, name)) {
        continue;
      }
      edges.push(
        this.createEdge({ relation: "property", name, required: true }, (): Node => ANY_NODE),
      );
    }

    if (isRecord(schema.patternProperties)) {
      for (const [pattern, value] of Object.entries(schema.patternProperties)) {
        if (!isJsonSchema(value)) {
          continue;
        }
        const childBase = this.childBase(value, base);
        edges.push(
          this.createEdge({ relation: "pattern-property", pattern }, (context?: Context): Node =>
            this.build(value, childBase, context),
          ),
        );
      }
    }

    const additional = isJsonSchema(schema.additionalProperties)
      ? schema.additionalProperties
      : true;
    const additionalBase = this.childBase(additional, base);
    edges.push(
      this.createEdge({ relation: "remaining-property" }, (context?: Context): Node =>
        this.build(additional, additionalBase, context),
      ),
    );

    if (isJsonSchema(schema.propertyNames)) {
      const nameSchema = schema.propertyNames;
      const nameBase = this.childBase(nameSchema, base);
      edges.push(
        this.createEdge({ relation: "property-name" }, (context?: Context): Node =>
          this.build(nameSchema, nameBase, context),
        ),
      );
    }

    if (schema.unevaluatedProperties !== undefined) {
      const unevaluated = asSchema(schema.unevaluatedProperties);
      const unevaluatedBase = this.childBase(unevaluated, base);
      edges.push(
        this.createEdge(
          { relation: "json-schema-2020-12:unevaluated-property" },
          (context?: Context): Node => this.build(unevaluated, unevaluatedBase, context),
        ),
      );
    }
  }

  private addArrayEdges(schema: JsonSchemaObject, base: string, edges: Edge[]): void {
    if (Array.isArray(schema.prefixItems)) {
      schema.prefixItems.forEach((value, index) => {
        const itemSchema = asSchema(value);
        const childBase = this.childBase(itemSchema, base);
        edges.push(
          this.createEdge({ relation: "item", index }, (context?: Context): Node =>
            this.build(itemSchema, childBase, context),
          ),
        );
      });
    }

    const items = schema.items === undefined ? true : asSchema(schema.items);
    const itemsBase = this.childBase(items, base);
    edges.push(
      this.createEdge({ relation: "items" }, (context?: Context): Node =>
        this.build(items, itemsBase, context),
      ),
    );

    if (schema.contains !== undefined) {
      const containsSchema = asSchema(schema.contains);
      const containsBase = this.childBase(containsSchema, base);
      edges.push(
        this.createEdge({ relation: "json-schema-2020-12:contains" }, (context?: Context): Node =>
          this.build(containsSchema, containsBase, context),
        ),
      );
    }

    if (schema.unevaluatedItems !== undefined) {
      const unevaluated = asSchema(schema.unevaluatedItems);
      const unevaluatedBase = this.childBase(unevaluated, base);
      edges.push(
        this.createEdge(
          { relation: "json-schema-2020-12:unevaluated-item" },
          (context?: Context): Node => this.build(unevaluated, unevaluatedBase, context),
        ),
      );
    }
  }

  private buildTypeUnion(
    schema: JsonSchemaObject,
    base: string,
    types: readonly JsonSchemaTypeName[],
    context?: Context,
  ): JsonSchema202012Node {
    const edges: Edge[] = [];

    for (const type of types) {
      if (context !== undefined && !this.isValid({ type }, base, context.value)) {
        continue;
      }

      const branch = this.buildStructural(schema, base, type);
      edges.push(this.createEdge({ relation: "any-of" }, (): Node => branch));
    }

    return this.createKindNode("unknown", this.annotations(schema, "unknown"), edges);
  }

  private buildEnum(
    schema: JsonSchemaObject,
    base: string,
    context?: Context,
  ): JsonSchema202012Node {
    const values = schema.enum ?? [];
    if (values.length === 0) {
      return this.createKindNode("never", this.annotations(schema, "never"));
    }

    const edges: Edge[] = [];
    for (const value of values) {
      if (context !== undefined && !jsonEqual(value, context.value)) {
        continue;
      }
      const node = this.buildConst(value);
      edges.push(this.createEdge({ relation: "one-of" }, (): Node => node));
    }

    return this.createKindNode("unknown", this.annotations(schema, "unknown"), edges);
  }

  private buildConst(value: unknown, annotations?: JsonSchemaAnnotation): JsonSchema202012Node {
    const kind = this.kindOfValue(value);
    const annotation: Record<string, unknown> = {
      ...annotations,
      const: value,
    };
    return this.createKindNode(kind, annotation as AnnotationMap[typeof kind]);
  }

  private buildArrayCombinator(
    schema: JsonSchemaObject,
    base: string,
    keyword: "allOf" | "anyOf" | "oneOf",
    relation: Relation,
    context?: Context,
  ): JsonSchema202012Node {
    const definitions = schema[keyword] ?? [];
    const edges: Edge[] = [];
    const narrow = relation.relation === "any-of" || relation.relation === "one-of";

    for (const value of definitions) {
      const child = asSchema(value);
      const childBase = this.childBase(child, base);
      if (context !== undefined && narrow && !this.isValid(child, childBase, context.value)) {
        continue;
      }
      edges.push(
        this.createEdge(relation, (edgeContext?: Context): Node =>
          this.build(child, childBase, edgeContext),
        ),
      );
    }

    return this.createKindNode("unknown", this.annotations(schema, "unknown"), edges);
  }

  private buildIf(schema: JsonSchemaObject, base: string, context?: Context): JsonSchema202012Node {
    const ifSchema = asSchema(schema.if);
    const thenSchema = asSchema(schema.then);
    const elseSchema = asSchema(schema.else);
    return this.buildConditional(
      ifSchema,
      thenSchema,
      elseSchema,
      base,
      this.annotations(schema, "unknown"),
      context,
    );
  }

  private buildConditional(
    ifSchema: JsonSchema,
    thenSchema: JsonSchema,
    elseSchema: JsonSchema,
    base: string,
    annotations: UnknownAnnotation,
    context?: Context,
  ): JsonSchema202012Node {
    const ifBase = this.childBase(ifSchema, base);
    const thenBase = this.childBase(thenSchema, base);
    const elseBase = this.childBase(elseSchema, base);

    const ifEdge = this.createEdge({ relation: "if" }, (edgeContext?: Context): Node =>
      this.build(ifSchema, ifBase, edgeContext),
    );
    const thenEdge = this.createEdge({ relation: "then" }, (edgeContext?: Context): Node =>
      this.build(thenSchema, thenBase, edgeContext),
    );
    const elseEdge = this.createEdge({ relation: "else" }, (edgeContext?: Context): Node =>
      this.build(elseSchema, elseBase, edgeContext),
    );

    if (context === undefined) {
      return this.createKindNode("unknown", annotations, [ifEdge, thenEdge, elseEdge]);
    }

    const conditionMatches = this.isValid(ifSchema, ifBase, context.value);
    return this.createKindNode("unknown", annotations, [
      ifEdge,
      conditionMatches ? thenEdge : elseEdge,
    ]);
  }

  private buildNot(schema: JsonSchemaObject, base: string): JsonSchema202012Node {
    const child = asSchema(schema.not);
    const childBase = this.childBase(child, base);
    return this.createKindNode("unknown", this.annotations(schema, "unknown"), [
      this.createEdge({ relation: "json-schema-2020-12:not" }, (context?: Context): Node =>
        this.build(child, childBase, context),
      ),
    ]);
  }

  private hasDependencies(schema: JsonSchemaObject): boolean {
    return (
      (isRecord(schema.dependencies) && Object.keys(schema.dependencies).length > 0) ||
      (isRecord(schema.dependentRequired) && Object.keys(schema.dependentRequired).length > 0) ||
      (isRecord(schema.dependentSchemas) && Object.keys(schema.dependentSchemas).length > 0)
    );
  }

  private buildDependencies(
    schema: JsonSchemaObject,
    base: string,
    context?: Context,
  ): JsonSchema202012Node {
    const conditionals: Array<{
      readonly ifSchema: JsonSchema;
      readonly thenSchema: JsonSchema;
      readonly elseSchema: JsonSchema;
    }> = [];

    const add = (name: string, dependency: unknown): void => {
      const ifSchema: JsonSchemaObject = {
        type: "object",
        required: [name],
      };
      let thenSchema: JsonSchema;
      if (Array.isArray(dependency)) {
        const required = dependency.filter((value): value is string => typeof value === "string");
        thenSchema = { required };
      } else {
        thenSchema = asSchema(dependency);
      }
      conditionals.push({ ifSchema, thenSchema, elseSchema: true });
    };

    if (isRecord(schema.dependencies)) {
      for (const [name, dependency] of Object.entries(schema.dependencies)) {
        add(name, dependency);
      }
    }
    if (isRecord(schema.dependentRequired)) {
      for (const [name, dependency] of Object.entries(schema.dependentRequired)) {
        add(name, dependency);
      }
    }
    if (isRecord(schema.dependentSchemas)) {
      for (const [name, dependency] of Object.entries(schema.dependentSchemas)) {
        add(name, dependency);
      }
    }

    if (conditionals.length === 1) {
      const conditional = conditionals[0];
      return this.buildConditional(
        conditional.ifSchema,
        conditional.thenSchema,
        conditional.elseSchema,
        base,
        this.annotations(schema, "unknown"),
        context,
      );
    }

    const edges: Edge[] = conditionals.map((conditional) =>
      this.createEdge({ relation: "all-of" }, (edgeContext?: Context): Node =>
        this.buildConditional(
          conditional.ifSchema,
          conditional.thenSchema,
          conditional.elseSchema,
          base,
          {},
          edgeContext,
        ),
      ),
    );

    return this.createKindNode("unknown", this.annotations(schema, "unknown"), edges);
  }

  private annotations<K extends NodeKind>(schema: JsonSchemaObject, kind: K): AnnotationMap[K] {
    const result: Record<string, unknown> = {};

    const setString = (name: string, value: unknown): void => {
      if (typeof value === "string") {
        result[name] = value;
      }
    };
    const setNumber = (name: string, value: unknown): void => {
      if (typeof value === "number") {
        result[name] = value;
      }
    };
    const setBoolean = (name: string, value: unknown): void => {
      if (typeof value === "boolean") {
        result[name] = value;
      }
    };

    setString("$schema", schema.$schema);
    setString("$id", schema.$id);
    setString("$ref", schema.$ref);
    setString("$anchor", schema.$anchor);
    setString("$dynamicRef", schema.$dynamicRef);
    setString("$dynamicAnchor", schema.$dynamicAnchor);
    setString("$comment", schema.$comment);
    setString("title", schema.title);
    setString("description", schema.description);

    if (Object.hasOwn(schema, "default")) {
      result.default = schema.default;
    }
    if (Object.hasOwn(schema, "const")) {
      result.const = schema.const;
    }
    if (schema.examples !== undefined) {
      result.examples = schema.examples;
    }
    setBoolean("readOnly", schema.readOnly);
    setBoolean("writeOnly", schema.writeOnly);
    setBoolean("deprecated", schema.deprecated);

    if (kind === "string" || kind === "unknown") {
      setString("format", schema.format);
      setString("contentEncoding", schema.contentEncoding);
      setString("contentMediaType", schema.contentMediaType);
      setNumber("maxLength", schema.maxLength);
      setNumber("minLength", schema.minLength);
      setString("pattern", schema.pattern);
    }

    if (kind === "number" || kind === "integer" || kind === "unknown") {
      setNumber("multipleOf", schema.multipleOf);
      setNumber("maximum", schema.maximum);
      setNumber("exclusiveMaximum", schema.exclusiveMaximum);
      setNumber("minimum", schema.minimum);
      setNumber("exclusiveMinimum", schema.exclusiveMinimum);
    }

    if (kind === "object" || kind === "unknown") {
      setNumber("maxProperties", schema.maxProperties);
      setNumber("minProperties", schema.minProperties);
      if (Array.isArray(schema.required)) {
        result.required = schema.required.filter(
          (name): name is string => typeof name === "string",
        );
      }
    }

    if (kind === "array" || kind === "unknown") {
      setNumber("maxItems", schema.maxItems);
      setNumber("minItems", schema.minItems);
      setNumber("maxContains", schema.maxContains);
      setNumber("minContains", schema.minContains);
      setBoolean("uniqueItems", schema.uniqueItems);
    }

    if (kind === "unknown" && schema.type !== undefined) {
      result.type = schema.type;
    }

    return result as AnnotationMap[K];
  }

  private typeNames(schema: JsonSchemaObject): JsonSchemaTypeName[] {
    const type = schema.type;
    if (typeof type === "string") {
      return isJsonSchemaTypeName(type) ? [type] : [];
    }
    if (!Array.isArray(type)) {
      return [];
    }

    const result: JsonSchemaTypeName[] = [];
    for (const value of type) {
      if (isJsonSchemaTypeName(value) && !result.includes(value)) {
        result.push(value);
      }
    }
    return result;
  }

  private inferredFamilies(schema: JsonSchemaObject): Family[] {
    const families: Family[] = [];

    if (this.hasObjectKeywords(schema)) {
      families.push("object");
    }
    if (this.hasArrayKeywords(schema)) {
      families.push("array");
    }
    if (
      schema.maxLength !== undefined ||
      schema.minLength !== undefined ||
      schema.pattern !== undefined ||
      schema.format !== undefined ||
      schema.contentEncoding !== undefined ||
      schema.contentMediaType !== undefined ||
      schema.contentSchema !== undefined
    ) {
      families.push("string");
    }
    if (
      schema.multipleOf !== undefined ||
      schema.maximum !== undefined ||
      schema.exclusiveMaximum !== undefined ||
      schema.minimum !== undefined ||
      schema.exclusiveMinimum !== undefined
    ) {
      families.push("number");
    }

    return families;
  }

  private hasObjectKeywords(schema: JsonSchemaObject): boolean {
    return (
      schema.properties !== undefined ||
      schema.patternProperties !== undefined ||
      schema.additionalProperties !== undefined ||
      schema.propertyNames !== undefined ||
      schema.required !== undefined ||
      schema.minProperties !== undefined ||
      schema.maxProperties !== undefined ||
      this.hasDependencies(schema) ||
      schema.unevaluatedProperties !== undefined
    );
  }

  private hasArrayKeywords(schema: JsonSchemaObject): boolean {
    return (
      schema.prefixItems !== undefined ||
      schema.items !== undefined ||
      schema.contains !== undefined ||
      schema.minItems !== undefined ||
      schema.maxItems !== undefined ||
      schema.uniqueItems !== undefined ||
      schema.unevaluatedItems !== undefined
    );
  }

  private kindOfValue(value: unknown): NodeKind {
    if (value === null) {
      return "null";
    }
    if (Array.isArray(value)) {
      return "array";
    }
    switch (typeof value) {
      case "boolean":
        return "boolean";
      case "number":
        return Number.isInteger(value) ? "integer" : "number";
      case "object":
        return "object";
      case "string":
        return "string";
      default:
        return "unknown";
    }
  }

  private childBase(schema: JsonSchema, parentBase: string): string {
    if (isSchemaObject(schema) && typeof schema.$id === "string") {
      return resolveUri(schema.$id, parentBase);
    }
    return parentBase;
  }

  private withReferenceAnnotations(schema: JsonSchemaObject, node: JsonSchema202012Node): Node {
    const local = this.annotations(schema, node.kind);
    const annotations: Record<string, unknown> = { ...node.annotations };
    let changed = false;

    for (const [name, value] of Object.entries(local)) {
      if (name !== "$ref" && name !== "$dynamicRef") {
        annotations[name] = value;
        changed = true;
      }
    }

    return changed ? ({ ...node, annotations } as JsonSchema202012Node) : node;
  }

  private createEdge(relation: Relation, node: (context?: Context) => Node): Edge {
    return { ...relation, node } as Edge;
  }

  private createKindNode<K extends NodeKind>(
    kind: K,
    annotations: AnnotationMap[K],
    edges: readonly Edge[] = NO_EDGES,
  ): JsonSchema202012Node {
    return { kind, annotations, edges } as JsonSchema202012Node;
  }
}

/**
 * Introspects a JSON Schema 2020-12 document. `$dynamicRef` resolves to its
 * statically indexed anchor; dynamic scope is not modeled, so a reference that
 * depends on the evaluation path may resolve differently than a validator
 * would.
 */
export function toSchemaIntrospection(
  schema: JsonSchema,
  options: JsonSchema202012IntrospectionOptions = {},
): JsonSchema202012Introspection {
  const introspector = new Introspector(schema, options);
  return {
    "~introspection": {
      version: 1,
      vendor: JSON_SCHEMA_2020_12_VENDOR,
      introspect: (introspectionOptions: SchemaIntrospectionV1.Options): JsonSchema202012Node =>
        introspector.introspect(introspectionOptions),
    },
  };
}
