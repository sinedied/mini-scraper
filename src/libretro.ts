import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs/promises';
import createDebug from 'debug';
import glob from 'fast-glob';
import { ArtTypeOption, type Options } from './options.js';
import { findBestMatch } from './matcher.js';
import { stats } from './stats.js';
import { machines } from './machines.js';
import { getOutputFormat } from './format/format.js';
import { ArtType } from './art.js';

const debug = createDebug('libretro');

export type MachineCache = Record<string, Partial<Record<ArtType, string[]>>>;

const baseUrl = 'https://thumbnails.libretro.com/';
const machineCache: MachineCache = {};

export function getMachine(file: string, isFolder = false) {
  const extension = file.split('.').pop() ?? '';
  const firstComponent = file.split(/\\|\//)[0];
  const machine = Object.entries(machines).find(([_, { extensions, alias }]) => {
    return (isFolder || extensions.includes(extension)) && alias.some((a) => firstComponent.includes(a));
  });
  return machine ? machine[0] : undefined;
}

export function isRomFolder(folderName: string) {
  return getMachine(folderName, true) !== undefined;
}

export async function scrapeFolder(folderPath: string, options: Options) {
  debug('Options:', options);
  console.info(`Scraping folder: ${folderPath} [Detected: ${getMachine(folderPath, true)}]`);
  const files = await glob(['**/*'], { onlyFiles: true, cwd: folderPath });

  for (const file of files) {
    try {
      const originalFilePath = path.join(folderPath, file);
      let filePath = originalFilePath;
      if (filePath.endsWith('.m3u')) {
        filePath = path.dirname(filePath);
        debug(`File is m3u, using parent folder for scraping: ${filePath}`);
      } else {
        // Check if it's a multi-disc, with "Rom Name (Disc 1).any" format,
        // with a "Rom Name.m3u" in the same folder
        const m3uPath = filePath.replace(/ \(Disc \d+\).+$/, '') + '.m3u';
        if (await pathExists(m3uPath)) {
          debug(`File is a multi-disc part, skipping: ${filePath}`);
          continue;
        }
      }

      const machine = getMachine(originalFilePath);
      if (!machine) continue;

      const format = await getOutputFormat(options);

      if (await format.useSeparateArtworks(options)) {
        const artTypes = getArtTypes(options);
        const art1Path = await format.getArtPath(originalFilePath, machine, artTypes.art1);
        if ((await pathExists(art1Path)) && !options.force) {
          debug(`Art file already exists, skipping "${art1Path}"`);
          stats.skipped++;
        } else {
          debug(`Machine: ${machine} (file: ${filePath})`);
          const art1Url = await findArtUrl(filePath, machine, options, artTypes.art1);
          const result = await format.exportArtwork(art1Url, undefined, art1Path, options);
          if (!result) {
            console.info(`No art found for "${filePath}"`);
          }
        }

        const art2Path = artTypes.art2 ? await format.getArtPath(originalFilePath, machine, artTypes.art2) : undefined;
        if (!art2Path) continue;
        if ((await pathExists(art2Path)) && !options.force) {
          debug(`Art file already exists, skipping "${art2Path}"`);
          stats.skipped++;
        } else {
          debug(`Machine: ${machine} (file: ${filePath})`);
          const art2Url = await findArtUrl(filePath, machine, options, artTypes.art2);
          const result = await format.exportArtwork(art2Url, undefined, art2Path, options);
          if (!result) {
            console.info(`No art found for "${filePath}"`);
          }
        }
      } else {
        const artPath = await format.getArtPath(originalFilePath, machine);
        if ((await pathExists(artPath)) && !options.force) {
          debug(`Art file already exists, skipping "${artPath}"`);
          stats.skipped++;
          continue;
        }

        debug(`Machine: ${machine} (file: ${filePath})`);
        const artTypes = getArtTypes(options);
        const art1Url = await findArtUrl(filePath, machine, options, artTypes.art1);
        const art2Url = artTypes.art2 ? await findArtUrl(filePath, machine, options, artTypes.art2) : undefined;
        const result = await format.exportArtwork(art1Url, art2Url, artPath, options);
        if (!result) {
          console.info(`No art found for "${filePath}"`);
        }
      }
    } catch (_error: unknown) {
      const error = _error as Error;
      console.error(`Error while scraping artwork for file "${file}": ${error.message}`);
    }
  }

  debug('--------------------------------');
}

export async function findArtUrl(
  filePath: string,
  machine: string,
  options: Options,
  type: ArtType = ArtType.Boxart,
  fallback = true
): Promise<string | undefined> {
  let arts = machineCache[machine]?.[type];
  if (!arts) {
    debug(`Fetching arts list for "${machine}" (${type})`);
    const artsPath = `${baseUrl}${machine}/${type}/`;
    const response = await fetch(artsPath);
    const text = await response.text();
    arts =
      text
        .match(/<a href="([^"]+)">/g)
        ?.map((a) => a.replace(/<a href="([^"]+)">/, '$1'))
        .map((a) => decodeURIComponent(a)) ?? [];
    machineCache[machine] ??= {};
    machineCache[machine][type] = arts;
  }

  const fileName = path.basename(filePath, path.extname(filePath));

  // Try exact match
  const pngName = santizeName(`${fileName}.png`);
  if (arts.includes(pngName)) {
    debug(`Found exact match for "${fileName}"`);
    stats.matches.perfect++;
    return `${baseUrl}${machine}/${type}/${pngName}`;
  }

  const findMatch = async (name: string) => {
    const matches = arts.filter((a) => a.includes(santizeName(name)));
    if (matches.length > 0) {
      const bestMatch = await findBestMatch(name, fileName, matches, options);
      return `${baseUrl}${machine}/${type}/${bestMatch}`;
    }

    return undefined;
  };

  // Try searching after removing (...) and [...] in the name
  let strippedName = fileName.replaceAll(/(\(.*?\)|\[.*?])/g, '').trim();
  let match = await findMatch(strippedName);
  if (match) return match;

  // Try searching after removing DX in the name
  strippedName = strippedName.replaceAll('DX', '').trim();
  match = await findMatch(strippedName);
  if (match) return match;

  // Try searching after removing substitles using ': '
  strippedName = strippedName.split(': ')[0].trim();
  match = await findMatch(strippedName);
  if (match) return match;

  // Try searching after removing substitles using '- '
  strippedName = strippedName.split('- ')[0].trim();
  match = await findMatch(strippedName);
  if (match) return match;

  // Try with fallback machines
  if (!fallback) return undefined;
  const fallbackMachines = machines[machine]?.fallbacks ?? [];
  for (const fallbackMachine of fallbackMachines) {
    const artUrl = await findArtUrl(filePath, fallbackMachine, options, type, false);
    if (artUrl) {
      debug(`Found match for "${fileName}" in fallback machine "${fallbackMachine}"`);
      return artUrl;
    }

    debug(`No match for "${fileName}" in fallback machine "${fallbackMachine}"`);
  }

  stats.matches.none++;
  return undefined;
}

export function santizeName(name: string) {
  return name.replaceAll(/[&*/:`<>?|"]/g, '_');
}

export function getArtTypes(options: Options) {
  switch (options.type) {
    case ArtTypeOption.Boxart: {
      return { art1: ArtType.Boxart };
    }

    case ArtTypeOption.Snap: {
      return { art1: ArtType.Snap };
    }

    case ArtTypeOption.Title: {
      return { art1: ArtType.Title };
    }

    case ArtTypeOption.BoxAndSnap: {
      return { art1: ArtType.Boxart, art2: ArtType.Snap };
    }

    case ArtTypeOption.BoxAndTitle: {
      return { art1: ArtType.Boxart, art2: ArtType.Title };
    }

    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    default: {
      console.error(`Invalid art type: "${options.type as any}"`);
      process.exit(1);
    }
  }
}

export async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
