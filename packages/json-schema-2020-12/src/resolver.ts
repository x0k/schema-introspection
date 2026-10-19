import { isRecord } from "./object.ts";
import { isJsonSchema, isSchemaObject, type JsonSchema, type JsonSchemaObject } from "./schema.ts";
import {
  DEFAULT_BASE_URI,
  decodeJsonPointer,
  fragmentOf,
  hasFragment,
  resolveUri,
  stripFragment,
} from "./uri.ts";

export interface ResolvedSchema {
  readonly schema: JsonSchema;
  readonly base: string;
}

export interface ResolverOptions {
  readonly baseUri?: string;
  readonly documents?: Readonly<Record<string, JsonSchema>>;
}

interface Resource {
  readonly schema: JsonSchema;
  readonly base: string;
}

function schemaChildren(schema: JsonSchemaObject): JsonSchema[] {
  const children: JsonSchema[] = [];
  const add = (value: unknown): void => {
    if (isJsonSchema(value)) {
      children.push(value);
    }
  };
  const addArray = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) {
        add(child);
      }
    }
  };
  const addRecord = (value: unknown): void => {
    if (isRecord(value)) {
      for (const child of Object.values(value)) {
        add(child);
      }
    }
  };

  add(schema.additionalItems);
  add(schema.contains);
  add(schema.additionalProperties);
  add(schema.propertyNames);
  add(schema.if);
  add(schema.then);
  add(schema.else);
  add(schema.not);
  add(schema.items);
  add(schema.contentSchema);
  add(schema.unevaluatedItems);
  add(schema.unevaluatedProperties);

  addArray(schema.prefixItems);

  addArray(schema.allOf);
  addArray(schema.anyOf);
  addArray(schema.oneOf);

  addRecord(schema.properties);
  addRecord(schema.patternProperties);
  addRecord(schema.definitions);
  addRecord(schema.$defs);
  addRecord(schema.dependentSchemas);

  if (isRecord(schema.dependencies)) {
    for (const dependency of Object.values(schema.dependencies)) {
      if (!Array.isArray(dependency)) {
        add(dependency);
      }
    }
  }

  return children;
}

export class SchemaResolver {
  private readonly resources: Map<string, Resource> = new Map();
  private readonly anchors: Map<string, Resource> = new Map();
  private readonly schemaBases: Map<object, string> = new Map();
  private readonly indexing: Map<object, Set<string>> = new Map();
  private readonly rootSchema: JsonSchema;
  private readonly rootBaseUri: string;

  constructor(root: JsonSchema, options: ResolverOptions = {}) {
    this.rootSchema = root;
    this.rootBaseUri = this.indexDocument(root, options.baseUri ?? DEFAULT_BASE_URI);

    for (const [uri, document] of Object.entries(options.documents ?? {})) {
      this.indexDocument(document, resolveUri(uri, this.rootBaseUri));
    }
  }

  get root(): JsonSchema {
    return this.rootSchema;
  }

  get base(): string {
    return this.rootBaseUri;
  }

  resolve(reference: string, fromBase: string): ResolvedSchema | undefined {
    const absolute = resolveUri(reference, fromBase);
    const fragment = fragmentOf(absolute);
    const documentUri = stripFragment(absolute);

    if (fragment === undefined || fragment === "") {
      return this.resources.get(documentUri) ?? this.anchors.get(absolute);
    }

    if (fragment.startsWith("/")) {
      const resource = this.resources.get(documentUri);
      if (resource === undefined) {
        return undefined;
      }
      return this.resolvePointer(resource, fragment);
    }

    return this.anchors.get(absolute);
  }

  private indexDocument(schema: JsonSchema, retrievalUri: string): string {
    const base = resolveUri(retrievalUri, DEFAULT_BASE_URI);
    const effectiveBase = this.indexSchema(schema, base);
    const resource: Resource = { schema, base: effectiveBase };
    this.resources.set(stripFragment(base), resource);
    this.resources.set(stripFragment(effectiveBase), resource);
    return effectiveBase;
  }

  private indexSchema(schema: JsonSchema, parentBase: string): string {
    if (!isSchemaObject(schema)) {
      return parentBase;
    }

    const id = typeof schema.$id === "string" ? schema.$id : undefined;
    const base = id === undefined ? parentBase : resolveUri(id, parentBase);
    let indexedBases = this.indexing.get(schema);
    if (indexedBases === undefined) {
      indexedBases = new Set();
      this.indexing.set(schema, indexedBases);
    } else if (indexedBases.has(base)) {
      return base;
    }
    indexedBases.add(base);

    this.schemaBases.set(schema, base);

    if (id !== undefined) {
      const resource: Resource = { schema, base };
      this.anchors.set(base, resource);
      if (!hasFragment(base)) {
        this.resources.set(stripFragment(base), resource);
      }
    }

    const anchor = typeof schema.$anchor === "string" ? schema.$anchor : undefined;
    if (anchor !== undefined) {
      this.anchors.set(`${stripFragment(base)}#${anchor}`, { schema, base });
    }
    const dynamicAnchor =
      typeof schema.$dynamicAnchor === "string" ? schema.$dynamicAnchor : undefined;
    if (dynamicAnchor !== undefined) {
      this.anchors.set(`${stripFragment(base)}#${dynamicAnchor}`, { schema, base });
    }

    for (const child of schemaChildren(schema)) {
      this.indexSchema(child, base);
    }

    return base;
  }

  private resolvePointer(resource: Resource, fragment: string): ResolvedSchema | undefined {
    const tokens = decodeJsonPointer(fragment);
    if (tokens === undefined) {
      return undefined;
    }

    let current: unknown = resource.schema;
    let base = resource.base;

    for (const token of tokens) {
      if (Array.isArray(current)) {
        if (!/^(?:0|[1-9]\d*)$/.test(token)) {
          return undefined;
        }
        const index = Number(token);
        if (index >= current.length) {
          return undefined;
        }
        current = current[index];
      } else if (isRecord(current)) {
        if (!Object.hasOwn(current, token)) {
          return undefined;
        }
        current = current[token];
      } else {
        return undefined;
      }

      if (isSchemaObject(current)) {
        const indexedBase = this.schemaBases.get(current);
        if (indexedBase !== undefined) {
          base = indexedBase;
        } else if (typeof current.$id === "string") {
          base = resolveUri(current.$id, base);
        }
      }
    }

    if (!isJsonSchema(current)) {
      return undefined;
    }

    return { schema: current, base };
  }
}
