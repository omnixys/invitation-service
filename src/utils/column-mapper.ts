/**
 * Column mapping engine
 *
 * WHY:
 * - Accept arbitrary CSV headers
 * - Normalize to internal schema
 * - Reduce user friction
 */

export type CanonicalField =
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'email'
  | 'maxPlusOnes';

const ALIASES: Record<CanonicalField, string[]> = {
  firstName: ['firstname', 'first name', 'vorname', 'givenname'],
  lastName: ['lastname', 'last name', 'nachname', 'surname'],
  phone: ['phone', 'telefon', 'mobile', 'handy', 'phonenumber'],
  email: ['email', 'mail', 'e-mail'],
  maxPlusOnes: ['maxplusones', 'plusones', 'guests', 'invitees'],
};

interface ColumnMappingResult {
  mapping: Record<string, CanonicalField | null>;
  confidence: Record<string, number>;
}

function normalize(input: string): string {
  return input.replace(/\s+/g, '').toLowerCase();
}

export function mapColumns(headers: string[]): ColumnMappingResult {
  const mapping: Record<string, CanonicalField | null> = {};
  const confidence: Record<string, number> = {};

  for (const header of headers) {
    const normalized = normalize(header);

    let bestMatch: CanonicalField | null = null;
    let bestScore = 0;

    for (const field of Object.keys(ALIASES) as CanonicalField[]) {
      for (const alias of ALIASES[field]) {
        if (normalized === normalize(alias)) {
          bestMatch = field;
          bestScore = 1;
        }

        if (normalized.includes(normalize(alias))) {
          bestMatch = field;
          bestScore = Math.max(bestScore, 0.7);
        }
      }
    }

    mapping[header] = bestMatch;
    confidence[header] = bestScore;
  }

  return {
    mapping,
    confidence,
  };
}
