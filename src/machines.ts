export type Machine = {
  extensions: string[];
  alias: string[];
  fallbacks?: string[];
  folders?: boolean;
};

export const machines: Record<string, Machine> = {
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
  'Nintendo - Nintendo DSi': {
    extensions: ['dsi', 'zip'],
    alias: ['DSi', 'Nintendo DSi'],
    fallbacks: ['Nintendo - Nintendo DS']
  },
  'Nintendo - Nintendo DS': {
    extensions: ['nds', 'zip'],
    alias: ['DS', 'Nintendo DS']
  },
  'Nintendo - Nintendo Entertainment System': {
    extensions: ['nes', 'zip'],
    alias: ['NES', 'FC', 'Famicom', 'Nintendo']
  },
  'Nintendo - Pokemon Mini': {
    extensions: ['pm', 'min', 'zip'],
    alias: ['PKM', 'Pokemon Mini']
  },
  'Nintendo - Virtual Boy': {
    extensions: ['vb', 'zip'],
    alias: ['VB', 'Virtual Boy']
  },
  'Handheld Electronic Game': {
    extensions: ['mgw', 'zip'],
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
  'Sega - Mega-CD - Sega CD': {
    extensions: ['chd', 'iso', 'cue', 'm3u'],
    alias: ['MDCD', 'Mega CD', 'Sega CD', 'MegaCD', 'SegaCD']
  },
  'Sega - Mega Drive - Genesis': {
    extensions: ['md', 'gen', 'zip'],
    alias: ['MD', 'Mega Drive', 'Genesis']
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
    extensions: ['iso', 'cso', 'chd', 'm3u', 'pbp'],
    alias: ['PSP', 'PlayStation Portable'],
    fallbacks: ['Sony - PlayStation']
  },
  'Sony - PlayStation': {
    extensions: ['chd', 'cue', 'm3u', 'pbp'],
    alias: ['PS', 'PSX', 'PS1', 'PlayStation']
  },
  'Sega - Naomi 2': {
    extensions: ['zip'],
    alias: ['NAOMI2'],
    fallbacks: ['Sega - Naomi']
  },
  'Sega - Naomi': {
    extensions: ['zip'],
    alias: ['NAOMI'],
    fallbacks: ['Sega - Naomi 2']
  },
  'Amstrad - CPC': {
    extensions: ['dsk', 'zip'],
    alias: ['CPC', 'Amstrad']
  },
  'Atari - ST': {
    extensions: ['st', 'zip'],
    alias: ['ST', 'ATARIST', 'Atari ST']
  },
  'Atari - 2600': {
    extensions: ['a26', 'zip'],
    alias: ['A26', '2600', 'Atari 2600', 'Atari']
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
    alias: ['FBN', 'FBNeo', 'FB Alpha', 'FBA', 'Final Burn Alpha'],
    fallbacks: ['MAME']
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
    alias: ['MAME', 'CPS1', 'CPS2', 'CPS3', 'VARCADE'],
    fallbacks: ['SNK - Neo Geo']
  },
  'Microsoft - MSX2': {
    extensions: ['msx2', 'zip'],
    alias: ['MSX2']
  },
  'Microsoft - MSX': {
    extensions: ['rom', 'zip'],
    alias: ['MSX'],
    fallbacks: ['Microsoft - MSX2']
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
    alias: ['NEOGEO', 'Neo Geo'],
    fallbacks: ['MAME']
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
  },
  Atomiswave: {
    extensions: ['zip'],
    alias: ['Atomiswave']
  }
};
