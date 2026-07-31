import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { scrapeFolder } from '../../src/libretro.js';
import { resetStats, stats } from '../../src/stats.js';
import { startMockServices } from '../helpers/mock-services.js';
import { createOptions } from '../helpers/options.js';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const cleanups: Array<() => Promise<void>> = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  delete process.env.MSCRAPER_THUMBNAIL_URL;
  const pendingCleanups = [...cleanups];
  cleanups.length = 0;
  await Promise.all(pendingCleanups.map(async (cleanup) => cleanup()));
  resetStats();
  vi.restoreAllMocks();
});

describe('regular scrape smoke test', () => {
  test('scrapes existing GBC fixtures against controlled thumbnail responses', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const artworkNames = [
      'Pokemon - Silver Version (USA, Europe) (SGB Enhanced) (GB Compatible).png',
      'Wario Land 3 (World) (En,Ja).png'
    ];
    const service = await startMockServices({ artworkNames });
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-scraper-smoke-'));
    cleanups.push(service.close, async () => fs.rm(directory, { recursive: true }));
    await fs.cp(path.join(repositoryRoot, 'test', 'GBC'), path.join(directory, 'GBC'), { recursive: true });
    await fs.rm(path.join(directory, 'GBC', '.res'), {
      recursive: true,
      force: true
    });
    process.chdir(directory);
    process.env.MSCRAPER_THUMBNAIL_URL = `${service.baseUrl}/`;

    await scrapeFolder('GBC', createOptions());

    await expect(
      fs.access(path.join(directory, 'GBC', '.res', 'Wario Land 3 (World) (En,Ja).zip.png'))
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(directory, 'GBC', '.res', 'Pokemon - Version Argent (France) (SGB Enhanced).zip.png'))
    ).resolves.toBeUndefined();
    expect(stats.matches.perfect).toBe(1);
    expect(stats.matches.partial).toBe(1);
  });

  test('handles multidisc playlists without scraping their referenced disc files', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const artworkNames = [
      'Colony Wars (France).png',
      'Final Fantasy VII (Europe).png',
      'Final Fantasy VII (France).png',
      'Moto Racer 2 (Europe) (En,Fr,De,Es,It,Sv).png'
    ];
    const service = await startMockServices({ artworkNames });
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-scraper-multidisc-'));
    cleanups.push(service.close, async () => fs.rm(directory, { recursive: true }));
    await fs.cp(path.join(repositoryRoot, 'test', 'PS'), path.join(directory, 'PS'), {
      recursive: true
    });
    await fs.rm(path.join(directory, 'PS', '.res'), {
      recursive: true,
      force: true
    });
    await fs.rm(path.join(directory, 'PS', 'Colony Wars (France)', '.res'), {
      recursive: true,
      force: true
    });
    await fs.rm(path.join(directory, 'PS', 'Final Fantasy VII (France)', '.res'), {
      recursive: true,
      force: true
    });
    process.chdir(directory);
    process.env.MSCRAPER_THUMBNAIL_URL = `${service.baseUrl}/`;

    await scrapeFolder('PS', createOptions());

    await expect(
      fs.access(path.join(directory, 'PS', '.res', 'Final Fantasy VII (Europe).m3u.png'))
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(directory, 'PS', 'Final Fantasy VII (France)', '.res', 'Final Fantasy VII (France).m3u.png'))
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(directory, 'PS', '.res', 'Final Fantasy VII (Europe) (Disc 1).chd.png'))
    ).rejects.toThrow();
    expect(stats.matches.perfect).toBe(4);
  });

  test('skips existing artwork unless force is enabled', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const service = await startMockServices({
      artworkNames: ['Wario Land 3 (World) (En,Ja).png']
    });
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-scraper-force-'));
    cleanups.push(service.close, async () => fs.rm(directory, { recursive: true }));
    await fs.cp(path.join(repositoryRoot, 'test', 'GBC'), path.join(directory, 'GBC'), {
      recursive: true
    });
    await fs.rm(path.join(directory, 'GBC', 'Pokemon - Version Argent (France) (SGB Enhanced).zip'));
    const artPath = path.join(directory, 'GBC', '.res', 'Wario Land 3 (World) (En,Ja).zip.png');
    await fs.mkdir(path.dirname(artPath), { recursive: true });
    await fs.writeFile(artPath, 'existing');
    process.chdir(directory);
    process.env.MSCRAPER_THUMBNAIL_URL = `${service.baseUrl}/`;

    await scrapeFolder('GBC', createOptions());
    expect(stats.skipped).toBe(1);
    await expect(fs.readFile(artPath, 'utf8')).resolves.toBe('existing');

    resetStats();
    await scrapeFolder('GBC', createOptions({ force: true }));
    expect(stats.matches.perfect).toBe(1);
    await expect(fs.readFile(artPath)).resolves.not.toEqual(Buffer.from('existing'));
  });
});
