// ── Doc id format ─────────────────────────────────────────────────────────────
// docid_{24 random base36 chars}_e
//   - 'docid_' prefix identifies WHAT the id is.
//   - '_e'     suffix marks where the id ends.
// Base36 (lowercase) keeps ids case-insensitive-filesystem safe. 24 chars keep
// the random space above UUID v4: 36^24 ≈ 2.2e37 > 2^122 ≈ 5.3e36.
// Existing ids in other formats (e.g. legacy uppercase base62 with '_E') are
// respected as-is — see DocIdStore.ensureDocId.

export const DOC_ID_PREFIX = 'docid_';
export const DOC_ID_SUFFIX = '_e';
export const DOC_ID_RANDOM_LENGTH = 24;

const BASE36_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const BASE36_SIZE = BASE36_ALPHABET.length;
// Largest multiple of 36 that fits in a byte (36 * 7 = 252). Bytes at or above
// this are rejected so `byte % 36` stays uniform — plain modulo over 0..255
// would bias the first 4 alphabet characters.
const MAX_UNBIASED_BYTE_EXCLUSIVE = 252;

export interface DocIdGenerator {
  /** Generates a fresh id in the docid_{24 base36}_e format. */
  generate(): string;
}

export class DocIdGeneratorDefault implements DocIdGenerator {
  generate(): string {
    return DOC_ID_PREFIX + this.randomBase36(DOC_ID_RANDOM_LENGTH) + DOC_ID_SUFFIX;
  }

  private randomBase36(length: number): string {
    const chars: string[] = [];
    while (chars.length < length) {
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      for (const byte of bytes) {
        if (byte < MAX_UNBIASED_BYTE_EXCLUSIVE && chars.length < length) {
          chars.push(BASE36_ALPHABET.charAt(byte % BASE36_SIZE));
        }
      }
    }
    return chars.join('');
  }
}
