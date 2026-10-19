/**
 * Expose a schema one node at a time. Each node reports a local kind and
 * direct relationship edges; an edge exposes its child node on demand. A
 * library or adapter declares the protocol on the schemas it can describe;
 * the `vendor` field identifies it and its vocabulary.
 *
 * Unprefixed kind, relation and annotation names are reserved for the
 * common vocabulary; others take the form `namespace:name`. Consumers treat
 * a kind they do not recognize as `unknown`, and a relation they do not
 * recognize as absent, i.e. its coverage as unknown.
 *
 * The interface comes first; the common vocabulary in `./kinds.ts`,
 * `./relations.ts` and `./annotations.ts` is a separate, optional registry
 * implementations report subsets of.
 */

export * from "./annotations.ts";
export * from "./kinds.ts";
export * from "./protocol.ts";
export * from "./relations.ts";
