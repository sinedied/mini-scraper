import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ArtType } from '../../src/art.js';
import anbernic from '../../src/format/anbernic.js';
import funkey from '../../src/format/funkey.js';
import { getOutputFormat } from '../../src/format/format.js';
import minui from '../../src/format/minui.js';
import muos from '../../src/format/muos.js';
import nextui from '../../src/format/nextui.js';
import { createOptions } from '../helpers/options.js';

const temporaryPaths: string[] = [];

afterEach(async () => {
  const pendingPaths = [...temporaryPaths];
  temporaryPaths.length = 0;
  await Promise.all(pendingPaths.map(async (targetPath) => fs.rm(targetPath, { recursive: true })));
  vi.restoreAllMocks();
});

describe('output formats', () => {
  test('generates paths for each supported layout', async () => {
    const filePath = path.join('GBC', 'Wario Land 3.zip');

    await expect(minui.getArtPath(filePath, 'Nintendo - Game Boy Color')).resolves.toBe(
      path.join('GBC', '.res', 'Wario Land 3.zip.png')
    );
    await expect(nextui.getArtPath(filePath, 'Nintendo - Game Boy Color')).resolves.toBe(
      path.join('GBC', '.media', 'Wario Land 3.png')
    );
    await expect(anbernic.getArtPath(filePath, 'Nintendo - Game Boy Color')).resolves.toBe(
      path.join('GBC', 'Imgs', 'Wario Land 3.png')
    );
    await expect(funkey.getArtPath(filePath, 'Nintendo - Game Boy Color')).resolves.toBe(
      path.join('GBC', 'Wario Land 3.png')
    );
  });

  test('maps Onion to the Anbernic implementation', async () => {
    const onion = await getOutputFormat(createOptions({ output: 'onion' }));
    expect(onion).toBe(anbernic);
  });

  test('scopes cleanup to selected ROM folders with glob characters', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-scraper-cleanup-'));
    temporaryPaths.push(root);
    const selected = path.join(root, 'Game Boy (GB)', 'Hacks', '.res');
    const untouched = path.join(root, 'GBC', '.res');
    await fs.mkdir(selected, { recursive: true });
    await fs.mkdir(untouched, { recursive: true });

    await minui.cleanupArtwork(root, ['Game Boy (GB)'], createOptions());

    await expect(fs.access(selected)).rejects.toThrow();
    await expect(fs.access(untouched)).resolves.toBeUndefined();
  });

  test('prepares muOS paths and theme overrides from the volume root', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-scraper-muos-'));
    temporaryPaths.push(root);
    await fs.writeFile(path.join(root, 'autorun.inf'), '');
    const romFolder = path.join(root, 'GBC');
    await fs.mkdir(romFolder);
    const existingOverride = path.join(root, 'theme', 'override', 'muxplore.txt');
    await fs.mkdir(path.dirname(existingOverride), { recursive: true });
    await fs.writeFile(existingOverride, '[misc]\nCONTENT_WIDTH=320\n');
    const options = createOptions({ output: 'muos', width: 240 });

    await muos.prepareMachine(romFolder, 'Nintendo - Game Boy Color', options);
    await expect(
      muos.getArtPath(path.join(romFolder, 'Wario Land 3.zip'), 'Nintendo - Game Boy Color', ArtType.Boxart)
    ).resolves.toBe(path.join(root, 'MUOS', 'info', 'catalogue', 'Nintendo Game Boy Color', 'box', 'Wario Land 3.png'));
    await expect(fs.readFile(existingOverride, 'utf8')).resolves.toContain('CONTENT_WIDTH=240');
  });
});
