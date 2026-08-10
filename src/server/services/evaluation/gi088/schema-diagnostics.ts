const ZOD_CODES = new Set([
  "custom",
  "invalid_date",
  "invalid_enum_value",
  "invalid_intersection_types",
  "invalid_literal",
  "invalid_string",
  "invalid_type",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_arguments",
  "invalid_return_type",
  "not_finite",
  "not_multiple_of",
  "too_big",
  "too_small",
  "unrecognized_keys"
]);

function safePath(value: unknown) {
  if (!Array.isArray(value)) return "$";
  const segments = value
    .slice(0, 12)
    .flatMap((segment) => {
      if (typeof segment === "number" && Number.isSafeInteger(segment)) {
        return [String(segment)];
      }
      if (
        typeof segment === "string" &&
        /^[A-Za-z][A-Za-z0-9]*$/u.test(segment)
      ) {
        return [segment];
      }
      return [];
    });
  return segments.length ? segments.join(".") : "$";
}

export function createGi088OutputSchemaIssues(error: unknown) {
  if (error instanceof SyntaxError) {
    return ["OUTPUT_SCHEMA_INVALID:$:invalid_json"];
  }
  if (!error || typeof error !== "object" || !("issues" in error)) {
    return ["OUTPUT_SCHEMA_INVALID"];
  }
  const issues = (error as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return ["OUTPUT_SCHEMA_INVALID"];
  const safeIssues = issues.slice(0, 12).flatMap((issue) => {
    if (!issue || typeof issue !== "object") return [];
    const code = (issue as { code?: unknown }).code;
    if (typeof code !== "string" || !ZOD_CODES.has(code)) return [];
    return [
      `OUTPUT_SCHEMA_INVALID:${safePath(
        (issue as { path?: unknown }).path
      )}:${code}`
    ];
  });
  return safeIssues.length ? safeIssues : ["OUTPUT_SCHEMA_INVALID"];
}
