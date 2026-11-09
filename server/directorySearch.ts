/** Search helper for a private server-maintained Firestore directory. */
export function normalizeDirectorySearch(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ar').trim().replace(/\s+/g, ' ');
}

/** Short n-grams preserve substring candidates, including one- and two-character searches. */
export function directorySearchTrigrams(name: string, email: string): string[] {
  const grams = new Set<string>();
  for (const value of [name, email]) {
    const chars = Array.from(normalizeDirectorySearch(value));
    for (let i = 0; i < chars.length; i++) {
      for (let length = 1; length <= 3 && i + length <= chars.length; length++) grams.add(chars.slice(i, i + length).join(''));
    }
  }
  return [...grams].sort();
}

export function directoryMatchesSearch(name: string, email: string, query: string): boolean {
  const normalized = normalizeDirectorySearch(query);
  return !normalized || normalizeDirectorySearch(name).includes(normalized) || normalizeDirectorySearch(email).includes(normalized);
}
