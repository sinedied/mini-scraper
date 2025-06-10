import process from 'node:process';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname, basename } from 'node:path';
import { program } from 'commander';
import debug from 'debug';
import glob from 'fast-glob';
import updateNotifier from 'update-notifier';
import { isRomFolder, scrapeFolder } from './libretro.js';
import { type Options } from './options.js';
import { checkOllama } from './ollama.js';
import { stats } from './stats.js';
import { getOutputFormat } from './format/format.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function run(args: string[] = process.argv) {
  const file = await fs.readFile(join(__dirname, '..', 'package.json'), 'utf8');
  const packageJson = JSON.parse(file);

  updateNotifier({ pkg: packageJson }).notify();

  if (args.includes('--verbose')) {
    debug.enable('*');
  }

  program
    .name(basename(process.argv[1]))
    .description(packageJson.description)
    .argument('<rompath>', 'Path to the folder containing the ROMs')
    .option('-w, --width <size>', 'Max width of the image', Number.parseFloat, 300)
    .option('-h, --height <size>', 'Max height of the image', Number.parseFloat)
    .option('-t, --type <type>', 'Art type (boxart, snap, title, box+snap, box+title)', 'boxart')
    .option('-o, --output <format>', 'Artwork format (minui, nextui, muos, anbernic, onion)', 'minui')
    .option('-a, --ai', 'Use AI for advanced matching', false)
    .option('-m, --ai-model <name>', 'Ollama model to use for AI matching', 'gemma2:2b')
    .option('-r, --regions <regions>', 'Preferred regions to use for AI matching', 'World,Europe,USA,Japan')
    .option('-f, --force', 'Force scraping over existing images')
    .option('--cleanup', 'Removes all scraped images in target folder')
    .option('--verbose', 'Show detailed logs')
    .version(packageJson.version, '-v, --version', 'Show current version')
    .helpCommand(false)
    .allowExcessArguments(false)
    .action(async (targetPath: string, options: Options) => {
      stats.startTime = Date.now();
      process.chdir(targetPath);

      let romFolders: string[] = [];
      const targetFolder = basename(targetPath);
      if (isRomFolder(targetFolder)) {
        debug(`Target folder "${targetFolder}" is a ROM folder`);
        romFolders.push(targetFolder);
        process.chdir('..');
      } else {
        const allFolders = await glob(['*'], { onlyDirectories: true });
        romFolders = allFolders.filter(isRomFolder);
        debug(`Found ${romFolders.length} ROM folders`);
      }

      if (romFolders.length === 0) {
        console.info('No ROM folders found');
        return;
      }

      const log = debug('cli');
      log('Found ROM folders:', romFolders);

      if (options.cleanup) {
        const format = await getOutputFormat(options);
        await format.cleanupArtwork('.', romFolders, options);
        return;
      }

      if (options.ai) {
        const ollama = await checkOllama(options.aiModel);
        if (!ollama) {
          process.exitCode = 1;
          return;
        }
      }

      for (const folder of romFolders) {
        await scrapeFolder(folder, options);
        console.info('--------------------------------');
      }

      const elapsed = Date.now() - stats.startTime;
      const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
      const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));

      console.info(`Scraped ${romFolders.length} folders (in ${minutes}m ${seconds}s)`);
      console.info(`- ${stats.matches.perfect} perfect matches`);
      console.info(`- ${stats.matches.partial} partial matches`);
      if (options.ai) console.info(`- ${stats.matches.ai} AI matches`);
      console.info(`- ${stats.matches.none} not found`);
      if (stats.skipped) console.info(`- ${stats.skipped} existing`);
    });

  program.parse(args);
}
