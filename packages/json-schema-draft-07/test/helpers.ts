import assert from "node:assert/strict";

import { Ajv } from "ajv";

import type { SchemaIntrospectionV1 } from "@schema-introspection/spec";

import {
  adapter,
  type JsonSchema,
  type JsonSchemaDraft07AdapterOptions,
  type JsonSchemaDraft07Edge,
  type JsonSchemaDraft07Node,
} from "../src/index.ts";

export type Edge = JsonSchemaDraft07Edge;
export type Node = JsonSchemaDraft07Node;

export function introspect(
  schema: JsonSchema,
  options: SchemaIntrospectionV1.Options,
  adapterOptions: JsonSchemaDraft07AdapterOptions = {},
): Node {
  return adapter(schema, adapterOptions)["~introspection"].introspect(options);
}

const ajv = new Ajv({ strict: false });

export function validates(schema: unknown, value: unknown): boolean {
  return (ajv.validate as (schema: unknown, data: unknown) => boolean)(schema, value);
}

export function edges(node: Node): readonly Edge[] {
  return node.edges;
}

export function edgeOf<R extends Edge["relation"]>(
  node: Node,
  relation: R,
): Extract<Edge, { relation: R }> {
  const found = edges(node).find(
    (candidate): candidate is Extract<Edge, { relation: R }> => candidate.relation === relation,
  );
  if (found === undefined) {
    throw new Error(`Missing ${relation} edge`);
  }
  return found;
}

export function property(node: Node, name: string): Extract<Edge, { relation: "property" }> {
  const found = edges(node).find(
    (candidate): candidate is Extract<Edge, { relation: "property" }> =>
      candidate.relation === "property" && candidate.name === name,
  );
  if (found === undefined) {
    throw new Error(`Missing property edge: ${name}`);
  }
  return found;
}

export function kindNode<K extends Node["kind"]>(node: Node, kind: K): Extract<Node, { kind: K }> {
  assert.equal(node.kind, kind);
  return node as Extract<Node, { kind: K }>;
}
