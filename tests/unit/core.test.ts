import { afterEach, describe, expect, test, vi } from 'vitest';
import { ArtType } from '../../src/art.js';
import { getArtTypes, getMachine, isRomFolder } from '../../src/libretro.js';
import { findBestMatch, findFuzzyMatches } from '../../src/matcher.js';
import { ArtTypeOption } from '../../src/options.js';
import { resetStats, stats } from '../../src/stats.js';
import { createOptions } from '../helpers/options.js';

afterEach(() => {
  resetStats();
  vi.restoreAllMocks();
});

describe('core matching behavior', () => {
  test('detects machines from aliases and extensions', () => {
    expect(getMachine('GBC/Wario Land 3.zip')).toBe('Nintendo - Game Boy Color');
    expect(getMachine('Game Boy (GB)/Tetris.gb')).toBe('Nintendo - Game Boy');
    expect(isRomFolder('PS')).toBe(true);
    expect(isRomFolder('ignore')).toBe(false);
  });

  test.each([
    [ArtTypeOption.Boxart, { art1: ArtType.Boxart }],
    [ArtTypeOption.Snap, { art1: ArtType.Snap }],
    [ArtTypeOption.Title, { art1: ArtType.Title }],
    [ArtTypeOption.BoxAndSnap, { art1: ArtType.Boxart, art2: ArtType.Snap }],
    [ArtTypeOption.BoxAndTitle, { art1: ArtType.Boxart, art2: ArtType.Title }]
  ])('maps %s to its artwork types', (type, expected) => {
    expect(getArtTypes(createOptions({ type }))).toEqual(expected);
  });

  test('uses deterministic partial matching when AI is disabled', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const candidates = ['Pokemon - Gold Version (USA, Europe).png', 'Pokemon - Silver Version (USA, Europe).png'];

    await expect(
      findBestMatch('Pokemon - Silver Version', 'Pokemon - Version Argent', candidates, createOptions())
    ).resolves.toBe('Pokemon - Silver Version (USA, Europe).png');
    expect(stats.matches.partial).toBe(1);
  });

  test('returns only sufficiently similar fuzzy candidates in source order', async () => {
    const candidates = [
      'Pokemon - Silver Version (USA, Europe).png',
      'Unrelated Racing Game.png',
      'Pokemon - Gold Version (USA, Europe).png'
    ];

    await expect(findFuzzyMatches('Pokemon - Version Argent', candidates, createOptions())).resolves.toEqual([
      'Pokemon - Silver Version (USA, Europe).png',
      'Pokemon - Gold Version (USA, Europe).png'
    ]);
  });
});
