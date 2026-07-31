import { ArtTypeOption, type Options } from '../../src/options.js';

export function createOptions(overrides: Partial<Options> = {}): Options {
  return {
    width: 300,
    type: ArtTypeOption.Boxart,
    ai: false,
    aiModel: 'test-model',
    aiUrl: 'http://localhost:11434/v1',
    regions: 'World,Europe,USA,Japan',
    output: 'minui',
    ...overrides
  };
}
