import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { compareVersions, RELEASES, releasesSince } from './changelog';

describe('changelog', () => {
  it('documents the current version first, newest to oldest, in both places', () => {
    expect(RELEASES[0]!.version).toBe(pkg.version);
    const versions = RELEASES.map((r) => r.version);
    expect([...versions].sort((a, b) => compareVersions(b, a))).toEqual(versions);
    const markdown = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    for (const version of versions) expect(markdown).toContain(`## ${version.replace(/\.0$/, '')} `);
  });

  it('compares versions numerically', () => {
    expect(compareVersions('5.10.0', '5.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.6.0', '2.0.0')).toBeLessThan(0);
  });

  it('lists what changed since the version the user ran', () => {
    expect(releasesSince('5.0.0', '5.1.0').map((r) => r.version)).toEqual(['5.1.0']);
    expect(releasesSince('4.0.0', '5.1.0').map((r) => r.version)).toEqual(['5.1.0', '5.0.0']);
    // Installs from before 5.1 recorded nothing: they come from 1.0.
    expect(releasesSince(null, '5.1.0').at(-1)?.version).toBe('1.1.0');
    expect(releasesSince('5.1.0', '5.1.0')).toEqual([]);
  });
});
