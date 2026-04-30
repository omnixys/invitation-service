import type { CanonicalField } from './column-mapper.js';

export function applyMapping(
  rows: Array<Record<string, unknown>>,
  mapping: Record<string, CanonicalField | null>,
): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const mapped: Record<string, unknown> = {};

    for (const originalKey of Object.keys(row)) {
      const target = mapping[originalKey];

      if (target) {
        mapped[target] = row[originalKey];
      }
    }

    return mapped;
  });
}
