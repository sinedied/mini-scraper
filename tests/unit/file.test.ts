import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { pathExists, sanitizeName, stripMetadata } from '../../src/file.js';

const temporaryPaths: string[] = [];

afterEach(async () => {
  const pendingPaths = [...temporaryPaths];
  temporaryPaths.length = 0;
  await Promise.all(pendingPaths.map(async (targetPath) => fs.rm(targetPath, { recursive: true })));
});

describe('file helpers', () => {
  test('sanitizes numbered and filesystem-invalid names', () => {
    expect(sanitizeName('12) Doom & Doom: "Edition".png')).toBe('Doom _ Doom_ _Edition_.png');
  });

  test('removes nested metadata while preserving unmatched groups', () => {
    expect(stripMetadata('Game (USA (Rev 1)) [Hack]')).toBe('Game');
    expect(stripMetadata('Game (Unclosed')).toBe('Game (Unclosed');
  });

  test('detects existing and missing paths', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-scraper-file-'));
    temporaryPaths.push(directory);
    const filePath = path.join(directory, 'rom.zip');
    await fs.writeFile(filePath, '');

    await expect(pathExists(filePath)).resolves.toBe(true);
    await expect(pathExists(path.join(directory, 'missing.zip'))).resolves.toBe(false);
  });
});
