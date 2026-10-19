export function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

const objectPrototype = Object.prototype;

export function isRecord(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === objectPrototype || prototype === null;
}

export function isLooseRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value) && !Array.isArray(value);
}
