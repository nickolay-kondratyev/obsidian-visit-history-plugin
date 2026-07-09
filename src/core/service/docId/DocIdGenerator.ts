// ── Doc id format ─────────────────────────────────────────────────────────────
// docid_{21 random base62 chars}_E
//   - 'docid_' prefix identifies WHAT the id is.
//   - '_E'     suffix marks where the id ends.

export const DOC_ID_PREFIX = 'docid_';
export const DOC_ID_SUFFIX = '_E';
export const DOC_ID_RANDOM_LENGTH = 21;

const BASE62_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BASE62_SIZE = BASE62_ALPHABET.length;
// Largest multiple of 62 that fits in a byte (62 * 4 = 248). Bytes at or above
// this are rejected so `byte % 62` stays uniform — plain modulo over 0..255
// would bias the first 8 alphabet characters.
const MAX_UNBIASED_BYTE_EXCLUSIVE = 248;

export interface DocIdGenerator {
  /** Generates a fresh id in the docid_{21 base62}_E format. */
  generate(): string;
}

export class DocIdGeneratorDefault implements DocIdGenerator {
  generate(): string {
    return DOC_ID_PREFIX + this.randomBase62(DOC_ID_RANDOM_LENGTH) + DOC_ID_SUFFIX;
  }

  private randomBase62(length: number): string {
    const chars: string[] = [];
    while (chars.length < length) {
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      for (const byte of bytes) {
        if (byte < MAX_UNBIASED_BYTE_EXCLUSIVE && chars.length < length) {
          chars.push(BASE62_ALPHABET.charAt(byte % BASE62_SIZE));
        }
      }
    }
    return chars.join('');
  }
}
