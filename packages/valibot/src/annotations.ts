import type { AnnotationV1 } from "@schema-introspection/spec";

/** Annotations shared by every Valibot node. */
export interface ValibotAnnotation
  extends AnnotationV1.Title, AnnotationV1.Description, AnnotationV1.Default, AnnotationV1.Const {
  /** The value may be omitted; object properties use this for `required: false`. */
  readonly optional?: boolean;
  /** The value may be `null`; `nullable` nodes also expose a `null` branch. */
  readonly nullable?: boolean;
  /** The schema only accepts a present key, so the property stays required. */
  readonly exactOptional?: boolean;
  /** The schema marks its output as readonly. */
  readonly readOnly?: boolean;
  /** Parse failures are replaced by a fallback value. */
  readonly fallback?: boolean;
  /** The schema is an opaque custom check. */
  readonly custom?: boolean;
  /** The schema performs a transformation with no declared output shape. */
  readonly transform?: boolean;
  /** The property name a variant switches on. */
  readonly discriminator?: string;
  /** Examples attached with `examples()`. */
  readonly examples?: readonly unknown[];
  /** Values allowed by a `values` validation action. */
  readonly values?: readonly unknown[];
  /** Values rejected by `not_value` / `not_values` actions. */
  readonly notValues?: readonly unknown[];
  /** Brand names applied to the schema. */
  readonly brands?: readonly string[];
  /** Arbitrary metadata attached with `metadata()`. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StringAnnotation extends ValibotAnnotation {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly patternFlags?: string;
  readonly patterns?: readonly string[];
  readonly patternFlagsList?: readonly string[];
  readonly format?: string;
  readonly startsWith?: string;
  readonly endsWith?: string;
  readonly includes?: string;
  readonly minBytes?: number;
  readonly maxBytes?: number;
  readonly contentEncoding?: string;
}

export interface NumberAnnotation extends ValibotAnnotation {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly multipleOf?: number;
  readonly format?: string;
  readonly finite?: boolean;
}

export interface ObjectAnnotation extends ValibotAnnotation {
  /** How names outside `entries` are handled. */
  readonly unknownKeys?: "strip" | "strict" | "loose" | "catchall";
  /** Property names required in the current direction. */
  readonly required?: readonly string[];
  /** The object is a key/value record rather than a fixed shape. */
  readonly record?: boolean;
  readonly minProperties?: number;
  readonly maxProperties?: number;
}

export interface ArrayAnnotation extends ValibotAnnotation {
  readonly minItems?: number;
  readonly maxItems?: number;
}

export interface DateAnnotation extends ValibotAnnotation {
  readonly minimum?: Date;
  readonly maximum?: Date;
}

export interface BigIntAnnotation extends ValibotAnnotation {
  readonly minimum?: bigint;
  readonly maximum?: bigint;
}

export interface SetAnnotation extends ValibotAnnotation {
  readonly minSize?: number;
  readonly maxSize?: number;
}

export interface FileAnnotation extends ValibotAnnotation {
  readonly minSize?: number;
  readonly maxSize?: number;
  readonly mime?: readonly string[];
}

export interface InstanceAnnotation extends ValibotAnnotation {
  readonly class?: string;
}

export type UnknownAnnotation = ValibotAnnotation &
  StringAnnotation &
  NumberAnnotation &
  ObjectAnnotation &
  ArrayAnnotation &
  DateAnnotation &
  BigIntAnnotation &
  SetAnnotation &
  FileAnnotation &
  InstanceAnnotation & {
    /** The Valibot schema type when no dedicated kind is available. */
    readonly type?: string;
  };

export interface AnnotationMap {
  readonly unknown: UnknownAnnotation;
  readonly any: ValibotAnnotation;
  readonly never: ValibotAnnotation;
  readonly array: ArrayAnnotation;
  readonly boolean: ValibotAnnotation;
  readonly integer: NumberAnnotation;
  readonly null: ValibotAnnotation;
  readonly number: NumberAnnotation;
  readonly object: ObjectAnnotation;
  readonly string: StringAnnotation;
  readonly "si-valibot:bigint": BigIntAnnotation;
  readonly "si-valibot:blob": FileAnnotation;
  readonly "si-valibot:date": DateAnnotation;
  readonly "si-valibot:file": FileAnnotation;
  readonly "si-valibot:function": ValibotAnnotation;
  readonly "si-valibot:instance": InstanceAnnotation;
  readonly "si-valibot:map": ValibotAnnotation;
  readonly "si-valibot:nan": NumberAnnotation;
  readonly "si-valibot:promise": ValibotAnnotation;
  readonly "si-valibot:set": SetAnnotation;
  readonly "si-valibot:symbol": ValibotAnnotation;
  readonly "si-valibot:undefined": ValibotAnnotation;
  readonly "si-valibot:void": ValibotAnnotation;
}
