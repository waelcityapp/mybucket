export function offerShareExcerpt(description: string, limit = 120): string {
  const normalized = description.trim().replace(/\s+/gu, ' ');
  const letters = Array.from(normalized);
  if (letters.length <= limit) return normalized;
  const prefix = letters.slice(0, limit - 1).join('');
  const space = prefix.lastIndexOf(' ');
  return `${(space > limit / 2 ? prefix.slice(0, space) : prefix).trimEnd()}…`;
}
