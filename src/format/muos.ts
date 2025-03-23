import path from 'node:path';
import fs from 'node:fs/promises';
import createDebug from 'debug';
import { type Options } from '../options.js';
import { composeImageTo, resizeImageTo } from '../image.js';
import { ArtType } from '../art.js';
import { getArtTypes, getMachine } from '../libretro.js';

const debug = createDebug('muos');

const separateArtworks = false;
const artworkBasePath = '/MUOS/info/catalogue/';
// Maps machines to MUOS catalogue folders
const machineFolders: Record<string, string | undefined> = {
  'Nintendo - Game Boy Color': 'Nintendo Game Boy Color',
  'Nintendo - Game Boy Advance': 'Nintendo Game Boy Advance',
  'Nintendo - Game Boy': 'Nintendo Game Boy',
  'Nintendo - Super Nintendo Entertainment System': 'Nintendo SNES-SFC',
  'Nintendo - Nintendo 64DD': 'Nintendo N64',
  'Nintendo - Nintendo 64': 'Nintendo N64',
  'Nintendo - Family Computer Disk System': 'Nintendo NES-Famicom',
  'Nintendo - Nintendo Entertainment System': 'Nintendo NES-Famicom',
  'Nintendo - Nintendo DSi': 'Nintendo DS',
  'Nintendo - Nintendo DS': 'Nintendo DS',
  'Nintendo - Pokemon Mini': 'Nintendo Pokemon Mini',
  'Nintendo - Virtual Boy': 'Nintendo Virtual Boy',
  'Handheld Electronic Game': 'Handheld Electronic - Game and Watch',
  'Sega - 32X': 'Sega 32X',
  'Sega - Dreamcast': 'Sega Dreamcast',
  'Sega - Mega-CD - Sega CD': 'Sega Mega CD - Sega CD',
  'Sega - Mega Drive - Genesis': 'Sega Mega Drive - Genesis',
  'Sega - Game Gear': 'Sega Game Gear',
  'Sega - Master System - Mark III': 'Sega Master System',
  'Sega - Saturn': 'Sega Saturn',
  'Sony - PlayStation Portable': 'Sony Playstation Portable',
  'Sony - PlayStation': 'Sony PlayStation',
  'Sega - Naomi 2': 'Sega Atomiswave Naomi',
  'Sega - Naomi': 'Sega Atomiswave Naomi',
  'Amstrad - CPC': 'Amstrad',
  'Atari - ST': 'Atari ST-STE-TT-Falcon',
  'Atari - 2600': 'Atari 2600',
  'Atari - 5200': 'Atari 5200',
  'Atari - 7800': 'Atari 7800',
  'Atari - Jaguar': 'Atari Jaguar',
  'Atari - Lynx': 'Atari Lynx',
  'Bandai - WonderSwan Color': 'Bandai WonderSwan-Color',
  'Bandai - WonderSwan': 'Bandai WonderSwan-Color',
  'Coleco - ColecoVision': 'ColecoVision',
  'Commodore - Amiga': 'Commodore Amiga',
  'Commodore - VIC-20': 'Commodore VIC-20',
  'Commodore - 64': 'Commodore C64',
  'FBNeo - Arcade Games': 'Arcade',
  'GCE - Vectrex': 'GCE-Vectrex',
  'GamePark - GP32': undefined,
  MAME: 'Arcade',
  'Microsoft - MSX2': 'Microsoft - MSX',
  'Microsoft - MSX': 'Microsoft - MSX',
  'Mattel - Intellivision': 'Mattel - Intellivision',
  'NEC - PC Engine CD - TurboGrafx-CD': 'NEC PC Engine CD',
  'NEC - PC Engine SuperGrafx': 'NEC PC Engine SuperGrafx',
  'NEC - PC Engine - TurboGrafx 16': 'NEC PC Engine',
  'SNK - Neo Geo CD': 'SNK Neo Geo CD',
  'SNK - Neo Geo Pocket Color': 'SNK Neo Geo Pocket - Color',
  'SNK - Neo Geo Pocket': 'SNK Neo Geo Pocket - Color',
  'SNK - Neo Geo': 'SNK Neo Geo',
  'Magnavox - Odyssey2': 'Odyssey2 - VideoPac',
  'TIC-80': 'TIC-80',
  'Sharp - X68000': 'Sharp X68000',
  'Watara - Supervision': 'Watara Supervision',
  DOS: 'DOS',
  DOOM: 'DOOM',
  ScummVM: 'ScummVM',
  Atomiswave: 'Sega Atomiswave Naomi'
};
// Maps artwork types to folders
const artFolders: Record<ArtType, string> = {
  [ArtType.Boxart]: 'box',
  [ArtType.Snap]: 'preview',
  [ArtType.Title]: 'preview'
};
let volumeRootPath: string | undefined;

export async function useSeparateArtworks(_options: Options) {
  return separateArtworks;
}

export async function getArtPath(filePath: string, machine: string, type: ArtType = ArtType.Boxart) {
  const machineFolder = machineFolders[machine];
  if (!machineFolder) {
    throw new Error(`Machine "${machine}" not supported by MUOS`);
  }

  if (!type) {
    throw new Error(`Artwork type not specified for "${machine}"`);
  }

  const fileName = path.basename(filePath, path.extname(filePath));
  const root = await findVolumeRoot(filePath);
  return path.join(root, artworkBasePath, machineFolder, artFolders[type], `${fileName}.png`);
}

export async function exportArtwork(
  art1Url: string | undefined,
  art2Url: string | undefined,
  artPath: string,
  options: Options
) {
  if (separateArtworks) {
    if (!art1Url) return false;

    debug(`Found art URL: "${art1Url}"`);
    await resizeImageTo(art1Url, artPath, { width: options.width, height: options.height });
    return true;
  }

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
    const machine = getMachine(romFolder, true) ?? '';
    const machineFolder = machineFolders[machine];
    if (!machineFolder) {
      debug(`Machine "${machine}" not supported by MUOS, skipping`);
      continue;
    }

    const root = await findVolumeRoot(targetPath);
    const machineArtPath = path.join(root, artworkBasePath, machineFolder);
    await fs.rm(machineArtPath, { recursive: true });
    removed++;
  }

  console.info(`Removed ${removed} folders`);
}

async function findVolumeRoot(targetPath: string) {
  if (volumeRootPath) {
    return volumeRootPath;
  }

  const absolutePath = path.resolve(targetPath);
  const parts = absolutePath.split(path.sep);
  for (let i = parts.length; i > 0; i--) {
    const currentPath = parts.slice(0, i).join(path.sep);
    const autorunPath = path.join(currentPath, 'autorun.inf');
    try {
      await fs.access(autorunPath);
      volumeRootPath = currentPath;
      debug(`Found muOS root at "${currentPath}"`);
      return currentPath;
    } catch {
      // Ignore errors
    }
  }

  debug(`Could not determine muOS root for "${targetPath}" (looking for autorun.inf)`);
  volumeRootPath = path.dirname(targetPath);
  return volumeRootPath;
}

const muos = {
  useSeparateArtworks,
  getArtPath,
  exportArtwork,
  cleanupArtwork
};

export default muos;
