import { describe, it, expect } from 'vitest';
import { findFolderTrail } from './folderTrail';
import type { VaultNode } from '../core/data/VaultNode';

describe('findFolderTrail', () => {
  // GIVEN a vault tree: root / Projects / Alpha / note.md, plus root / Inbox
  const alpha: VaultNode = {
    name: 'Alpha',
    children: [{ name: 'note.md', path: 'Projects/Alpha/note.md', type: 'md', size: 10 }],
  };
  const projects: VaultNode = { name: 'Projects', children: [alpha] };
  const inbox: VaultNode = { name: 'Inbox', children: [] };
  const root: VaultNode = { name: 'vault', children: [projects, inbox] };

  it('should return the single folder node when path is a top-level folder', () => {
    // WHEN
    const trail = findFolderTrail(root, 'Projects');
    // THEN
    expect(trail).toEqual([projects]);
  });

  it('should return the full ancestor chain for a nested folder', () => {
    // WHEN
    const trail = findFolderTrail(root, 'Projects/Alpha');
    // THEN
    expect(trail).toEqual([projects, alpha]);
  });

  it('should return null when the folder does not exist in the tree', () => {
    // WHEN
    const trail = findFolderTrail(root, 'Projects/Missing');
    // THEN
    expect(trail).toBeNull();
  });

  it('should return null when the path resolves to a file, not a folder', () => {
    // WHEN — 'note.md' is a leaf node, not a folder
    const trail = findFolderTrail(root, 'Projects/Alpha/note.md');
    // THEN
    expect(trail).toBeNull();
  });
});
