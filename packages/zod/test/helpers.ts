import assert from "node:assert/strict";

import type { SchemaIntrospectionV1 } from "@schema-introspection/spec";

import {
  adapter,
  type ZodAdapterOptions,
  type ZodEdge,
  type ZodNode,
  type ZodSchema,
} from "../src/index.ts";

export type Edge = ZodEdge;
export type Node = ZodNode;

export function introspect(
  schema: ZodSchema,
  options: SchemaIntrospectionV1.Options,
  adapterOptions: ZodAdapterOptions = {},
): Node {
  return adapter(schema, adapterOptions)["~introspection"].introspect(options);
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
