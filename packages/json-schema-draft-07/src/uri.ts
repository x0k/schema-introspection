const ABSOLUTE_URI = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

export const DEFAULT_BASE_URI = "https://schema-introspection.invalid/json-schema-draft-07/root";

function stripQuery(uri: string): string {
  const index = uri.indexOf("?");
  return index < 0 ? uri : uri.slice(0, index);
}

function splitSuffix(reference: string): {
  readonly path: string;
  readonly suffix: string;
} {
  const query = reference.indexOf("?");
  const fragment = reference.indexOf("#");
  let index = -1;
  if (query < 0) {
    index = fragment;
  } else if (fragment < 0) {
    index = query;
  } else {
    index = Math.min(query, fragment);
  }
  return index < 0
    ? { path: reference, suffix: "" }
    : {
        path: reference.slice(0, index),
        suffix: reference.slice(index),
      };
}

function removeDotSegments(path: string): string {
  const segments = path.split("/");
  const output: string[] = [];

  for (const segment of segments) {
    if (segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (output.length > 1) {
        output.pop();
      }
      continue;
    }
    output.push(segment);
  }

  const result = output.join("/");
  if (result === "" && path.startsWith("/")) {
    return "/";
  }
  return result;
}

function authorityOf(uri: string): string | undefined {
  const match = /^([A-Za-z][A-Za-z0-9+.-]*:)\/\/([^/]*)/.exec(uri);
  return match === null ? undefined : `${match[1]}//${match[2]}`;
}

export function resolveUri(reference: string, base: string): string {
  if (ABSOLUTE_URI.test(reference)) {
    return reference;
  }
  if (base === "") {
    return reference;
  }

  if (reference === "") {
    return stripFragment(base);
  }
  if (reference.startsWith("#")) {
    return `${stripFragment(base)}${reference}`;
  }
  if (reference.startsWith("?")) {
    return `${stripQuery(stripFragment(base))}${reference}`;
  }

  const scheme = SCHEME.exec(base)?.[0];
  if (scheme === undefined) {
    return reference;
  }

  if (reference.startsWith("//")) {
    return `${scheme}${reference}`;
  }

  const basePath = stripQuery(stripFragment(base));
  const authority = authorityOf(basePath);
  if (authority === undefined) {
    return reference;
  }

  const { path, suffix } = splitSuffix(reference);
  if (path.startsWith("/")) {
    return `${authority}${removeDotSegments(path)}${suffix}`;
  }

  const baseRemainder = basePath.slice(authority.length);
  const slash = baseRemainder.lastIndexOf("/");
  const directory = slash < 0 ? "/" : baseRemainder.slice(0, slash + 1);
  return `${authority}${removeDotSegments(`${directory}${path}`)}${suffix}`;
}

export function hasFragment(uri: string): boolean {
  return uri.includes("#");
}

export function stripFragment(uri: string): string {
  const index = uri.indexOf("#");
  return index < 0 ? uri : uri.slice(0, index);
}

export function fragmentOf(uri: string): string | undefined {
  const index = uri.indexOf("#");
  return index < 0 ? undefined : uri.slice(index + 1);
}

export function decodeJsonPointer(fragment: string): string[] | undefined {
  if (fragment === "") {
    return [];
  }

  if (!fragment.startsWith("/")) {
    return undefined;
  }

  let pointer: string;
  try {
    pointer = decodeURIComponent(fragment.slice(1));
  } catch {
    return undefined;
  }

  if (pointer === "") {
    return [];
  }

  return pointer.split("/").map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}
