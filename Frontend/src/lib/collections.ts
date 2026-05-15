export function findFirst<T>(items: readonly T[], predicate: (item: T) => boolean): T | null {
  for (const item of items) {
    if (predicate(item)) {
      return item;
    }
  }

  return null;
}

export function includesText(source: string, candidate: string) {
  return source.indexOf(candidate) >= 0;
}
