import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Jimp } from 'jimp';
import { afterEach, describe, expect, test } from 'vitest';
import { composeImageTo, loadImage, resizeImageTo } from '../../src/image.js';
import { startMockServices } from '../helpers/mock-services.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  const pendingCleanups = [...cleanups];
  cleanups.length = 0;
  await Promise.all(pendingCleanups.map(async (cleanup) => cleanup()));
});

describe('image processing', () => {
  test('loads PNGs with trailing data through the fast-png repair path', async () => {
    const service = await startMockServices();
    cleanups.push(service.close);

    const image = await loadImage(`${service.baseUrl}/malformed.png`);
    expect(image.bitmap).toMatchObject({ width: 2, height: 2 });
  });

  test('resizes and composes artwork files', async () => {
    const service = await startMockServices();
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-scraper-image-'));
    cleanups.push(service.close, async () => fs.rm(directory, { recursive: true }));
    const resizedPath = path.join(directory, 'resized.png');
    const composedPath = path.join(directory, 'composed.png');
    const imageUrl = `${service.baseUrl}/art.png`;

    await resizeImageTo(imageUrl, resizedPath, { width: 8 });
    await composeImageTo(imageUrl, imageUrl, composedPath, {
      width: 12,
      height: 12
    });

    await expect(Jimp.read(resizedPath)).resolves.toMatchObject({
      bitmap: expect.objectContaining({ width: 8, height: 8 })
    });
    await expect(Jimp.read(composedPath)).resolves.toMatchObject({
      bitmap: expect.objectContaining({ width: 12, height: 12 })
    });
  });
});
