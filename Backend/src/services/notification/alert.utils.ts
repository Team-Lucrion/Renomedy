export function buildAlertDedupeKey(parts: Array<string | number | null | undefined>) {
  return parts
    .filter((value) => value !== null && value !== undefined && String(value).trim().length > 0)
    .map((value) => String(value).trim())
    .join(":");
}
