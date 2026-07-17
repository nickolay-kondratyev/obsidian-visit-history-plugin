import { describe, expect, it } from 'vitest';
import { UserNameSafety } from './UserNameSafety';

describe('UserNameSafety', () => {
  describe('isValidUserName', () => {
    it.each([
      'john_doe',
      'a',
      'john.doe-2',
      'a'.repeat(200),
    ])('should accept %j', (name) => {
      expect(UserNameSafety.isValidUserName(name)).toBe(true);
    });

    it.each([
      ['empty', ''],
      ['uppercase', 'John'],
      ['space', 'jo hn'],
      ['leading dot', '.john'],
      ['trailing dot', 'john.'],
      ['path separator', 'jo/hn'],
      ['backslash', 'jo\\hn'],
      ['overlong (201 chars)', 'a'.repeat(201)],
      ['non-ascii', 'jöhn'],
    ])('should reject %s', (_label, name) => {
      expect(UserNameSafety.isValidUserName(name)).toBe(false);
    });
  });

  describe('sanitizeToValidOrNull', () => {
    it('should lowercase and turn spaces into underscores', () => {
      expect(UserNameSafety.sanitizeToValidOrNull('John Doe')).toBe('john_doe');
    });

    it('should collapse a whitespace run into one underscore', () => {
      expect(UserNameSafety.sanitizeToValidOrNull('John  \t Doe')).toBe('john_doe');
    });

    it('should strip disallowed characters', () => {
      expect(UserNameSafety.sanitizeToValidOrNull('jöhn!#doe')).toBe('jhndoe');
    });

    it('should strip leading and trailing dots', () => {
      expect(UserNameSafety.sanitizeToValidOrNull('..john..')).toBe('john');
    });

    it('should return an already-valid name unchanged', () => {
      expect(UserNameSafety.sanitizeToValidOrNull('john_doe')).toBe('john_doe');
    });

    it('should cap the result at 200 characters', () => {
      expect(UserNameSafety.sanitizeToValidOrNull('a'.repeat(250))).toBe('a'.repeat(200));
    });

    it('should strip a trailing dot exposed by the length cap', () => {
      // GIVEN 200 chars ending in '.' after truncation
      const raw = 'a'.repeat(199) + '.' + 'b'.repeat(50);
      // WHEN / THEN the exposed trailing dot is stripped, not left invalid
      expect(UserNameSafety.sanitizeToValidOrNull(raw)).toBe('a'.repeat(199));
    });

    it('should return null when nothing valid remains', () => {
      expect(UserNameSafety.sanitizeToValidOrNull('###')).toBeNull();
    });

    it('should return null for an empty input', () => {
      expect(UserNameSafety.sanitizeToValidOrNull('')).toBeNull();
    });
  });
});
