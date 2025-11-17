import path from 'node:path';
import createDebug from 'debug';
import { getArtTypes } from '../libretro.js';
import { type Options } from '../options.js';
import { composeImageTo, resizeImageTo } from '../image.js';
import { type ArtType } from '../art.js';

const debug = createDebug('funkey');

export async function useSeparateArtworks(_options: Options) {
  return false;
}

export async function getArtPath(filePath: string, _machine: string, _type?: ArtType) {
  const fileName = path.basename(filePath, path.extname(filePath));
  return path.join(path.dirname(filePath), `${fileName}.png`);
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
  } else if art1Url) {
    debug(`Found art URL: "${art1Url}"`);
    await resizeImageTo(art1Url, artPath, { width: options.width, height: options.height });
  } else {
    return false;
  }

  return true;
}

export async function cleanupArtwork(_targetPath: string, _romFolders: string[], _options: Options) {
  // No cleanup needed since images are stored in the same folder as ROMs
  console.info('No artwork folders to clean up for funkey format');
}

const funkey = {
  useSeparateArtworks,
  getArtPath,
  exportArtwork,
  cleanupArtwork
};

export default funkey;
