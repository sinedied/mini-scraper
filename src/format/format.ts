import { type ArtType } from '../art.js';
import { type Options } from '../options.js';

export enum Format {
  MinUI = 'minui',
  NextUI = 'nextui',
  MuOS = 'muos',
  Anbernic = 'anbernic'
}

export type SeparateArtworksFunction = (options: Options) => Promise<boolean>;

export type PrepareMachineFunction = (folderPath: string, machine: string, options: Options) => Promise<void>;

export type OutputPathFunction = (filePath: string, machine: string, type?: ArtType) => Promise<string>;

export type OutputArtworkFunction = (
  url1: string | undefined,
  url2: string | undefined,
  artPath: string,
  options: Options
) => Promise<boolean>;

export type CleanupArtworkFunction = (targetPath: string, romFolders: string[], options: Options) => Promise<void>;

export type OutputFormat = {
  useSeparateArtworks: SeparateArtworksFunction;
  prepareMachine?: PrepareMachineFunction;
  getArtPath: OutputPathFunction;
  exportArtwork: OutputArtworkFunction;
  cleanupArtwork: CleanupArtworkFunction;
};

export async function getOutputFormat(options: Options): Promise<OutputFormat> {
  switch (options.output as Format) {
    case Format.MinUI: {
      const minui = await import('./minui.js');
      return minui.default;
    }

    case Format.NextUI: {
      const nextui = await import('./nextui.js');
      return nextui.default;
    }

    case Format.MuOS: {
      const muos = await import('./muos.js');
      return muos.default;
    }

    case Format.Anbernic: {
      const anbernic = await import('./anbernic.js');
      return anbernic.default;
    }

    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    default: {
      throw new Error(`Unknown format: ${options.output}`);
    }
  }
}
