import type { AnnotationV1 } from "@schema-introspection/spec";

import type { JsonSchemaTypeName } from "./schema.ts";

/** Annotations shared by every draft-07 schema node. */
export interface JsonSchemaAnnotation
  extends AnnotationV1.Title, AnnotationV1.Description, AnnotationV1.Default, AnnotationV1.Const {
  readonly $schema?: string;
  readonly $id?: string;
  readonly $ref?: string;
  readonly $comment?: string;
  readonly examples?: unknown;
  readonly readOnly?: boolean;
  readonly writeOnly?: boolean;
}

export interface StringAnnotation extends JsonSchemaAnnotation {
  readonly format?: string;
  readonly contentEncoding?: string;
  readonly contentMediaType?: string;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly pattern?: string;
}

export interface NumberAnnotation extends JsonSchemaAnnotation {
  readonly multipleOf?: number;
  readonly maximum?: number;
  readonly exclusiveMaximum?: number;
  readonly minimum?: number;
  readonly exclusiveMinimum?: number;
}

export interface ObjectAnnotation extends JsonSchemaAnnotation {
  readonly maxProperties?: number;
  readonly minProperties?: number;
  readonly required?: readonly string[];
}

export interface ArrayAnnotation extends JsonSchemaAnnotation {
  readonly maxItems?: number;
  readonly minItems?: number;
  readonly uniqueItems?: boolean;
}

export type UnknownAnnotation = JsonSchemaAnnotation &
  StringAnnotation &
  NumberAnnotation &
  ObjectAnnotation &
  ArrayAnnotation & {
    readonly type?: JsonSchemaTypeName | readonly JsonSchemaTypeName[];
  };

export interface AnnotationMap {
  readonly unknown: UnknownAnnotation;
  readonly any: JsonSchemaAnnotation;
  readonly never: JsonSchemaAnnotation;
  readonly array: ArrayAnnotation;
  readonly boolean: JsonSchemaAnnotation;
  readonly integer: NumberAnnotation;
  readonly null: JsonSchemaAnnotation;
  readonly number: NumberAnnotation;
  readonly object: ObjectAnnotation;
  readonly string: StringAnnotation;
}
