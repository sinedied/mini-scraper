import path from 'node:path';
import fs from 'node:fs/promises';
import createDebug from 'debug';
import glob from 'fast-glob';
import { getArtTypes } from '../libretro.js';
import { type Options } from '../options.js';
import { composeImageTo, resizeImageTo } from '../image.js';
import { type ArtType } from '../art.js';

const debug = createDebug('minui');
const resFolder = '.res';

export async function useSeparateArtworks(_options: Options) {
  return false;
}

export async function getArtPath(filePath: string, _machine: string, _type?: ArtType) {
  return path.join(path.dirname(filePath), resFolder, `${path.basename(filePath)}.png`);
}

export async function exportArtwork(
  art1Url: string | undefined,
  art2Url: string | undefined,
  artPath: string,
  options: Options
) {
  const artTypes = getArtTypes(options);
  if (artTypes.art2 && (art1Url ?? art2Url)) {
    debug(`Found art URL(s): "${art1Url}" / "${art2Url}"`);
    await composeImageTo(art1Url, art2Url, artPath, { width: options.width, height: options.height });
  } else if (art1Url) {
    debug(`Found art URL: "${art1Url}"`);
    await resizeImageTo(art1Url, artPath, { width: options.width, height: options.height });
  } else {
    return false;
  }

  return true;
}

export async function cleanupArtwork(targetPath: string, romFolders: string[], _options: Options) {
  let removed = 0;
  for (const romFolder of romFolders) {
    // Use the ROM folder as the glob's cwd (a real path) rather than interpolating its name
    // into the pattern, so names with glob-special characters (e.g. "Game Boy (GB)") still match.
    const romPath = path.join(targetPath, romFolder);
    const folders = await glob([`**/${resFolder}`], { onlyDirectories: true, cwd: romPath });
    await Promise.all(folders.map(async (folder) => fs.rm(path.join(romPath, folder), { recursive: true })));
    removed += folders.length;
  }

  console.info(`Removed ${removed} ${resFolder} folders`);
}

const minui = {
  useSeparateArtworks,
  getArtPath,
  exportArtwork,
  cleanupArtwork
};

export default minui;
