import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs/promises';
import createDebug from 'debug';
import glob from 'fast-glob';
import { composeImageTo, resizeImageTo } from './image.js';
import { ArtTypeOption, type Options } from './options.js';
import { findBestMatch } from './matcher.js';
import { stats } from './stats.js';

const debug = createDebug('libretro');

export type Machine = {
  extensions: string[];
  alias: string[];
  fallbacks?: string[];
  folders?: boolean;
};

export type MachineCache = Record<string, Partial<Record<ArtType, string[]>>>;

export enum ArtType {
  Boxart = 'Named_Boxarts',
  Snap = 'Named_Snaps',
  Title = 'Named_Titles'
}

const resFolder = '.res';
const mediaFolder = '.media';
const baseUrl = 'https://thumbnails.libretro.com/';
const machines: Record<string, Machine> = {
  'Nintendo - Game Boy Color': {
    extensions: ['gbc', 'zip'],
    alias: ['GBC', 'Game Boy Color'],
    fallbacks: ['Nintendo - Game Boy']
  },
  'Nintendo - Game Boy Advance': {
    extensions: ['gba', 'zip'],
    alias: ['GBA', 'Game Boy Advance']
  },
  'Nintendo - Game Boy': {
    extensions: ['gb', 'sgb', 'zip'],
    alias: ['GB', 'SGB', 'Game Boy'],
    fallbacks: ['Nintendo - Game Boy Color']
  },
  'Nintendo - Super Nintendo Entertainment System': {
    extensions: ['sfc', 'smc', 'zip'],
    alias: ['SNES', 'SFC', 'Super Famicom', 'Super Nintendo', 'Super NES']
  },
  'Nintendo - Nintendo 64DD': {
    extensions: ['n64dd', 'zip'],
    alias: ['N64DD', 'Nintendo 64DD'],
    fallbacks: ['Nintendo - Nintendo 64']
  },
  'Nintendo - Nintendo 64': {
    extensions: ['n64', 'v64', 'zip'],
    alias: ['N64', 'Nintendo 64']
  },
  'Nintendo - Family Computer Disk System': {
    extensions: ['fds', 'zip'],
    alias: ['FDS', 'Family Computer Disk System', 'Famicom Disk System']
  },
  'Nintendo - Nintendo Entertainment System': {
    extensions: ['nes', 'zip'],
    alias: ['NES', 'FC', 'Famicom', 'Nintendo']
  },
  'Nintendo - Nintendo DSi': {
    extensions: ['dsi', 'zip'],
    alias: ['DSi', 'Nintendo DSi'],
    fallbacks: ['Nintendo - Nintendo DS']
  },
  'Nintendo - Nintendo DS': {
    extensions: ['nds', 'zip'],
    alias: ['DS', 'Nintendo DS']
  },
  'Nintendo - Pokemon Mini': {
    extensions: ['pm', 'zip'],
    alias: ['PKM', 'Pokemon Mini']
  },
  'Nintendo - Virtual Boy': {
    extensions: ['vb', 'zip'],
    alias: ['VB', 'Virtual Boy']
  },
  'Handheld Electronic Game': {
    extensions: ['gw', 'zip'],
    alias: ['GW', 'Game & Watch']
  },
  'Sega - 32X': {
    extensions: ['32x', 'zip'],
    alias: ['32X', 'THIRTYTWOX']
  },
  'Sega - Dreamcast': {
    extensions: ['dc', 'chd', 'gdi', 'm3u'],
    alias: ['DC', 'Dreamcast']
  },
  'Sega - Mega Drive - Genesis': {
    extensions: ['md', 'gen', 'zip'],
    alias: ['MD', 'Mega Drive', 'Genesis']
  },
  'Sega - Mega-CD - Sega CD': {
    extensions: ['chd', 'iso', 'cue', 'm3u'],
    alias: ['Mega CD', 'Sega CD', 'MegaCD', 'SegaCD']
  },
  'Sega - Game Gear': {
    extensions: ['gg', 'zip'],
    alias: ['GG', 'Game Gear']
  },
  'Sega - Master System - Mark III': {
    extensions: ['sms', 'zip'],
    alias: ['SMS', 'MS', 'Master System', 'Mark III']
  },
  'Sega - Saturn': {
    extensions: ['chd', 'cue'],
    alias: ['Saturn']
  },
  'Sony - PlayStation Portable': {
    extensions: ['iso', 'cso', 'chd', 'm3u'],
    alias: ['PSP', 'PlayStation Portable'],
    fallbacks: ['Sony - PlayStation']
  },
  'Sony - PlayStation': {
    extensions: ['chd', 'cue', 'm3u'],
    alias: ['PS', 'PSX', 'PS1', 'PlayStation']
  },
  'Amstrad - CPC': {
    extensions: ['dsk', 'zip'],
    alias: ['CPC', 'Amstrad']
  },
  'Atari - 2600': {
    extensions: ['a26', 'zip'],
    alias: ['A26', '2600', 'Atari 2600']
  },
  'Atari - 5200': {
    extensions: ['a52', 'zip'],
    alias: ['A52', '5200', 'Atari 5200']
  },
  'Atari - 7800': {
    extensions: ['a78', 'zip'],
    alias: ['A78', '7800', 'Atari 7800']
  },
  'Atari - Jaguar': {
    extensions: ['jag', 'zip'],
    alias: ['JAG', 'Jaguar']
  },
  'Atari - Lynx': {
    extensions: ['lynx', 'zip'],
    alias: ['LYNX', 'Lynx']
  },
  'Atari - ST': {
    extensions: ['st', 'zip'],
    alias: ['ST', 'Atari ST']
  },
  'Bandai - WonderSwan Color': {
    extensions: ['wsc', 'zip'],
    alias: ['WSC', 'WonderSwan Color'],
    fallbacks: ['Bandai - WonderSwan']
  },
  'Bandai - WonderSwan': {
    extensions: ['ws', 'zip'],
    alias: ['WS', 'WonderSwan']
  },
  'Coleco - ColecoVision': {
    extensions: ['col', 'zip'],
    alias: ['COL', 'Coleco', 'ColecoVision']
  },
  'Commodore - Amiga': {
    extensions: ['adf', 'zip'],
    alias: ['ADF', 'Amiga']
  },
  'Commodore - VIC-20': {
    extensions: ['v64', 'zip'],
    alias: ['VIC']
  },
  'Commodore - 64': {
    extensions: ['d64', 'zip'],
    alias: ['D64', 'C64', 'Commodore 64', 'Commodore']
  },
  'FBNeo - Arcade Games': {
    extensions: ['zip'],
    alias: ['FBN', 'FBNeo', 'FB Alpha', 'FBA', 'Final Burn Alpha']
  },
  'GCE - Vectrex': {
    extensions: ['vec', 'zip'],
    alias: ['VEC', 'Vectrex']
  },
  'GamePark - GP32': {
    extensions: ['gp', 'zip'],
    alias: ['GP32', 'GamePark']
  },
  MAME: {
    extensions: ['zip'],
    alias: ['MAME']
  },
  'Microsoft - MSX': {
    extensions: ['rom', 'zip'],
    alias: ['MSX']
  },
  'Mattel - Intellivision': {
    extensions: ['int', 'zip'],
    alias: ['INT', 'Intellivision']
  },
  'NEC - PC Engine CD - TurboGrafx-CD': {
    extensions: ['chd', 'cue', 'm3u'],
    alias: ['PCECD', 'TGCD', 'PC Engine CD', 'TurboGrafx-CD']
  },
  'NEC - PC Engine SuperGrafx': {
    extensions: ['sgx', 'zip'],
    alias: ['SGFX', 'SGX', 'SuperGrafx']
  },
  'NEC - PC Engine - TurboGrafx 16': {
    extensions: ['pce', 'zip'],
    alias: ['PCE', 'TG16', 'PC Engine', 'TurboGrafx 16']
  },
  'SNK - Neo Geo CD': {
    extensions: ['chd', 'cue', 'm3u'],
    alias: ['NEOCD', 'NGCD', 'Neo Geo CD']
  },
  'SNK - Neo Geo Pocket Color': {
    extensions: ['ngc', 'zip'],
    alias: ['NGPC', 'Neo Geo Pocket Color'],
    fallbacks: ['SNK - Neo Geo Pocket']
  },
  'SNK - Neo Geo Pocket': {
    extensions: ['ngp', 'zip'],
    alias: ['NGP', 'Neo Geo Pocket']
  },
  'SNK - Neo Geo': {
    extensions: ['neogeo', 'zip'],
    alias: ['NEOGEO', 'Neo Geo']
  },
  'Magnavox - Odyssey2': {
    extensions: ['bin', 'zip'],
    alias: ['ODYSSEY']
  },
  'TIC-80': {
    extensions: ['tic', 'zip'],
    alias: ['TIC']
  },
  'Sharp - X68000': {
    extensions: ['hdf', 'zip'],
    alias: ['X68000']
  },
  'Watara - Supervision': {
    extensions: ['sv', 'zip'],
    alias: ['SV', 'Supervision']
  },
  DOS: {
    extensions: ['pc', 'dos', 'zip'],
    alias: ['DOS']
  },
  DOOM: {
    extensions: ['wad', 'zip'],
    alias: ['WAD']
  },
  ScummVM: {
    extensions: ['scummvm', 'zip'],
    alias: ['SCUMM']
  }
};
const aliases = Object.values(machines).flatMap((machine) => machine.alias);
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

    let imagesFolder = resFolder;
    if (options.flavor == 'NextUI') {
      imagesFolder = mediaFolder;
      filePath = removeExtension(filePath);
    }

    const artPath = path.join(path.dirname(filePath), imagesFolder, `${path.basename(filePath)}.png`);

    if ((await pathExists(artPath)) && !options.force) {
      debug(`Art file already exists, skipping "${artPath}"`);
      stats.skipped++;
      continue;
    }

    const machine = getMachine(originalFilePath);
    if (!machine) continue;

    debug(`Machine: ${machine} (file: ${filePath})`);
    const artTypes = getArtTypes(options);
    const art1Url = await findArtUrl(filePath, machine, options, artTypes.art1);
    const art2Url = artTypes.art2 ? await findArtUrl(filePath, machine, options, artTypes.art2) : undefined;
    if (artTypes.art2 && (art1Url ?? art2Url)) {
      debug(`Found art URL(s): "${art1Url}" / "${art2Url}"`);
      await composeImageTo(art1Url, art2Url, artPath, { width: options.width, height: options.height });
    } else if (art1Url) {
      debug(`Found art URL: "${art1Url}"`);
      await resizeImageTo(art1Url, artPath, { width: options.width, height: options.height });
    } else {
      console.info(`No art found for "${filePath}"`);
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

  // Try searching after removing substitles in the name
  strippedName = strippedName.split(' - ')[0].trim();
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

export async function cleanupResFolder(folderPath: string, flavor: string) {
  let imageFolder = resFolder;
  if (flavor == 'NextUI') {
    imageFolder = mediaFolder;
  }
  const resFolders = await glob([`**/${imageFolder}`], { onlyDirectories: true, cwd: folderPath });
  await Promise.all(resFolders.map(async (imageFolder) => fs.rm(imageFolder, { recursive: true })));
  console.info(`Removed ${resFolders.length} ${imageFolder} folders`);
}

export function santizeName(name: string) {
  return name.replaceAll(/[&*/:`<>?|"]/g, '_');
}

export function removeExtension(filename: string) {
    let lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename;
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

export async function pathExists(path: string) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
