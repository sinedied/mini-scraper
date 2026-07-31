import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { startMockServices } from '../helpers/mock-services.js';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  const pendingCleanups = [...cleanups];
  cleanups.length = 0;
  await Promise.all(pendingCleanups.map(async (cleanup) => cleanup()));
});

describe('AI-enabled CLI smoke test', () => {
  test('runs the built CLI with mock thumbnails and an OpenAI-compatible provider', async () => {
    const candidate = 'Pokemon - Silver Version (USA, Europe) (SGB Enhanced) (GB Compatible).png';
    const service = await startMockServices({
      artworkNames: [candidate, 'Wario Land 3 (World) (En,Ja).png'],
      completionResponses: [{ bestMatch: candidate }]
    });
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-scraper-ai-smoke-'));
    cleanups.push(service.close, async () => fs.rm(directory, { recursive: true }));
    await fs.cp(path.join(repositoryRoot, 'test', 'GBC'), path.join(directory, 'GBC'), { recursive: true });
    await fs.rm(path.join(directory, 'GBC', '.res'), {
      recursive: true,
      force: true
    });

    const result = await runCli(
      [directory, '--ai', '--ai-url', service.aiUrl, '--ai-key', 'secret-key', '--ai-model', 'test-model'],
      {
        MSCRAPER_THUMBNAIL_URL: `${service.baseUrl}/`
      }
    );

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('1 AI matches');
    await expect(
      fs.access(path.join(directory, 'GBC', '.res', 'Pokemon - Version Argent (France) (SGB Enhanced).zip.png'))
    ).resolves.toBeUndefined();
    expect(service.requests).toContainEqual(
      expect.objectContaining({
        path: '/v1/chat/completions',
        authorization: 'Bearer secret-key'
      })
    );
  });

  test('reports help, version, and missing arguments through Commander 15', async () => {
    const packageJson = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'package.json'), 'utf8')) as {
      version: string;
    };
    const help = await runCli(['--help']);
    const version = await runCli(['--version']);
    const missing = await runCli([]);
    const excess = await runCli(['test', 'extra']);
    const invalidPath = await runCli([path.join(os.tmpdir(), 'mini-scraper-does-not-exist')]);

    expect(help.code).toBe(0);
    expect(help.stdout).toContain('Usage: mscraper');
    expect(version.code).toBe(0);
    expect(version.stdout.trim()).toBe(packageJson.version);
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("missing required argument 'rompath'");
    expect(excess.code).toBe(1);
    expect(excess.stderr).toContain('too many arguments');
    expect(invalidPath.code).toBe(1);
    expect(invalidPath.stderr).toContain('no such file or directory');
  });

  test('runs cleanup without contacting external services', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-scraper-cleanup-cli-'));
    cleanups.push(async () => fs.rm(directory, { recursive: true }));
    const artworkDirectory = path.join(directory, 'GBC', '.res');
    await fs.mkdir(artworkDirectory, { recursive: true });
    await fs.writeFile(path.join(artworkDirectory, 'generated.png'), '');

    const result = await runCli([directory, '--cleanup']);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Removed 1 .res folders');
    await expect(fs.access(artworkDirectory)).rejects.toThrow();
  });
});

async function runCli(arguments_: string[], environment: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, [path.join(repositoryRoot, 'bin', 'mscraper.js'), ...arguments_], {
    cwd: repositoryRoot,
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  const code = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve(exitCode ?? 1);
    });
  });

  return { code, stdout, stderr };
}
