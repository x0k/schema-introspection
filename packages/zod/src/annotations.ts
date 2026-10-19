import type { AnnotationV1 } from "@schema-introspection/spec";

/** Annotations shared by every Zod node. */
export interface ZodAnnotation
  extends AnnotationV1.Title, AnnotationV1.Description, AnnotationV1.Default, AnnotationV1.Const {
  readonly id?: string;
  readonly deprecated?: boolean;
  readonly examples?: unknown;
  /** The value may be omitted; object properties use this for `required: false`. */
  readonly optional?: boolean;
  /** The value may be `null`; `nullable` nodes also expose a `null` branch. */
  readonly nullable?: boolean;
  /** The schema marks its output as readonly. */
  readonly readOnly?: boolean;
  /** The schema coerces its input instead of requiring the target type. */
  readonly coerce?: boolean;
  /** Parse failures are replaced by a fallback value. */
  readonly catch?: boolean;
  /** The schema is an opaque custom check. */
  readonly custom?: boolean;
  /** The schema performs a transformation with no declared output shape. */
  readonly transform?: boolean;
  /** The property name a discriminated union switches on. */
  readonly discriminator?: string;
}

export interface StringAnnotation extends ZodAnnotation {
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
  /** The schema rewrites its value with an opaque check. */
  readonly overwrite?: boolean;
  readonly template?: boolean;
}

export interface NumberAnnotation extends ZodAnnotation {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly multipleOf?: number;
  readonly format?: string;
}

export interface ObjectAnnotation extends ZodAnnotation {
  /** How names outside `shape` are handled. */
  readonly unknownKeys?: "strip" | "strict" | "loose" | "catchall";
  /** Property names required in the current direction. */
  readonly required?: readonly string[];
  /** The object is a key/value record rather than a fixed shape. */
  readonly record?: boolean;
  readonly recordMode?: "strict" | "loose";
}

export interface ArrayAnnotation extends ZodAnnotation {
  readonly minItems?: number;
  readonly maxItems?: number;
}

export interface DateAnnotation extends ZodAnnotation {
  readonly minimum?: Date;
  readonly maximum?: Date;
}

export interface BigIntAnnotation extends ZodAnnotation {
  readonly minimum?: bigint;
  readonly maximum?: bigint;
  readonly format?: string;
}

export interface SetAnnotation extends ZodAnnotation {
  readonly minSize?: number;
  readonly maxSize?: number;
}

export interface FileAnnotation extends ZodAnnotation {
  readonly minSize?: number;
  readonly maxSize?: number;
  readonly mime?: readonly string[];
}

export type UnknownAnnotation = ZodAnnotation &
  StringAnnotation &
  NumberAnnotation &
  ObjectAnnotation &
  ArrayAnnotation &
  DateAnnotation &
  BigIntAnnotation &
  SetAnnotation &
  FileAnnotation & {
    /** The Zod definition type when no dedicated kind is available. */
    readonly type?: string;
  };

export interface AnnotationMap {
  readonly unknown: UnknownAnnotation;
  readonly any: ZodAnnotation;
  readonly never: ZodAnnotation;
  readonly array: ArrayAnnotation;
  readonly boolean: ZodAnnotation;
  readonly integer: NumberAnnotation;
  readonly null: ZodAnnotation;
  readonly number: NumberAnnotation;
  readonly object: ObjectAnnotation;
  readonly string: StringAnnotation;
  readonly "zod:bigint": BigIntAnnotation;
  readonly "zod:date": DateAnnotation;
  readonly "zod:file": FileAnnotation;
  readonly "zod:function": ZodAnnotation;
  readonly "zod:map": ZodAnnotation;
  readonly "zod:nan": NumberAnnotation;
  readonly "zod:promise": ZodAnnotation;
  readonly "zod:set": SetAnnotation;
  readonly "zod:symbol": ZodAnnotation;
  readonly "zod:undefined": ZodAnnotation;
  readonly "zod:void": ZodAnnotation;
}
