// src/lib/nameUtils.ts

/**
 * Normalisation strips accents, lowercases, and collapses whitespace
 * so that 'Alice Johnson' and 'alice  johnson' are treated as the same name.
 */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')                     // decompose accents
    .replace(/[\u0300-\u036f]/g, '')    // strip diacritics
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim();
}

export type DuplicateStatus = 'ok' | 'exact' | 'fuzzy';

/**
 * Compares a name against a list of existing names and returns a status.
 * - 'exact': The normalized name matches an existing normalized name perfectly.
 * - 'fuzzy': One normalized name is a substring of the other (e.g., 'Alice J' vs 'Alice Johnson').
 * - 'ok': No match found.
 */
export function detectDuplicate(
  name: string,
  existingNames: string[]
): DuplicateStatus {
  const norm = normaliseName(name);
  const existingNorms = existingNames.map(normaliseName);

  if (existingNorms.includes(norm)) return 'exact';

  // Fuzzy: one name is a substring of the other (catches 'Alice J' vs 'Alice Johnson')
  if (existingNorms.some(e => e.includes(norm) || norm.includes(e))) return 'fuzzy';

  return 'ok';
}
