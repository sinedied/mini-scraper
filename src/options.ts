import { type AiProvider } from './ai.js';

export enum ArtTypeOption {
  Boxart = 'boxart',
  Snap = 'snap',
  Title = 'title',
  BoxAndSnap = 'box+snap',
  BoxAndTitle = 'box+title'
}

export type Options = {
  width: number;
  height?: number;
  type: ArtTypeOption;
  force?: boolean;
  ai?: boolean;
  aiModel: string;
  aiProvider?: AiProvider;
  aiUrl?: string;
  regions: string;
  output: string;
  cleanup?: boolean;
};
