import process from 'node:process';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import createDebug from 'debug';
import { DEFAULT_LMSTUDIO_URL, LmStudioProvider, probeLmStudio } from './ai/lmstudio.js';
import { DEFAULT_OLLAMA_URL, OllamaProvider, probeOllama } from './ai/ollama.js';

const debugDetect = createDebug('ai:detect');

export type AiProviderName = 'ollama' | 'lmstudio';

export const PROBE_TIMEOUT_MS = 500;

export type AiCompletion = Record<string, string | undefined> | undefined;

export type AiProvider = {
  name: AiProviderName;
  baseUrl: string;
  check(model: string): Promise<boolean>;
  hasModel(model: string): Promise<boolean>;
  getCompletion(prompt: string, model: string, retryCount?: number): Promise<AiCompletion>;
};

export type Probe = {
  up: boolean;
  hasModel: boolean;
};

export type DetectInput = {
  model: string;
  forcedProvider?: AiProviderName;
  url?: string;
};

const detectOllamaOrLmStudio = async (
  url: string,
  model: string,
  forcedProvider: AiProviderName
): Promise<AiProvider | undefined> => {
  if (forcedProvider === 'ollama') {
    const provider = new OllamaProvider(url ?? DEFAULT_OLLAMA_URL);
    console.info(`Using AI provider: ollama (${provider.baseUrl})`);
    const ok = await provider.check(model);
    return ok ? provider : undefined;
  }

  if (forcedProvider === 'lmstudio') {
    const provider = new LmStudioProvider(url ?? DEFAULT_LMSTUDIO_URL);
    console.info(`Using AI provider: lmstudio (${provider.baseUrl})`);
    const ok = await provider.check(model);
    return ok ? provider : undefined;
  }
};

const chooseProvider = async ({ model }: { model: string }) => {
  const [ollamaResult, lmStudioResult] = await Promise.allSettled([
    probeOllama(DEFAULT_OLLAMA_URL, model),
    probeLmStudio(DEFAULT_LMSTUDIO_URL, model)
  ]);
  debugDetect('Probing Ollama and LM Studio in parallel');
  const ollama: Probe = ollamaResult.status === 'fulfilled' ? ollamaResult.value : { up: false, hasModel: false };
  const lmStudio: Probe = lmStudioResult.status === 'fulfilled' ? lmStudioResult.value : { up: false, hasModel: false };
  debugDetect('Probe results — ollama:', ollama, 'lmstudio:', lmStudio);

  let pickLmStudio: boolean;
  if (ollama.up && !lmStudio.up) {
    pickLmStudio = false;
  } else if (lmStudio.up && !ollama.up) {
    pickLmStudio = true;
  } else if (lmStudio.hasModel && !ollama.hasModel) {
    pickLmStudio = true;
  } else {
    pickLmStudio = false;
  }

  return {
    pickLmStudio,
    ollama,
    lmStudio
  };
};

export async function detectProvider(input: DetectInput): Promise<AiProvider | undefined> {
  const { model, forcedProvider, url } = input;

  if (forcedProvider) {
    debugDetect(`Forced provider specified: ${forcedProvider}`);
    await detectOllamaOrLmStudio(url ?? '', model, forcedProvider);
  }

  if (url) {
    const provider = new OllamaProvider(url);
    console.info(`Using AI provider: ollama (${provider.baseUrl})`);
    const ok = await provider.check(model);
    return ok ? provider : undefined;
  }

  const { pickLmStudio, ollama, lmStudio } = await chooseProvider({ model });

  if (!ollama.up && !lmStudio.up) {
    console.error(
      'No local AI provider detected. Install one of:\n' +
        '  - Ollama: https://ollama.com/download\n' +
        '  - LM Studio: https://lmstudio.ai/download'
    );
    return undefined;
  }

  if (pickLmStudio) {
    const provider = new LmStudioProvider(DEFAULT_LMSTUDIO_URL);
    console.info(`Using AI provider: lmstudio (${provider.baseUrl})`);
    const result = await provider.checkDetail(model);
    if (result.ok) return provider;

    if (ollama.up) {
      const reason =
        result.reason === 'down' ? 'LM Studio became unreachable' : `model "${model}" is not loaded in LM Studio`;
      console.warn(`Falling back to Ollama: ${reason}.`);
      const fallback = new OllamaProvider(DEFAULT_OLLAMA_URL);
      console.info(`Using AI provider: ollama (${fallback.baseUrl})`);
      const fallbackOk = await fallback.check(model);
      return fallbackOk ? fallback : undefined;
    }

    if (result.reason === 'down') {
      console.error(
        `LM Studio is not running, but --ai option is enabled.\nDownload it from https://lmstudio.ai/download and start the local server.`
      );
    } else {
      console.error(
        `Model "${model}" is not loaded in LM Studio.\nOpen the app and load the model (LM Studio has no CLI auto-pull).`
      );
    }

    return undefined;
  }

  const provider = new OllamaProvider(DEFAULT_OLLAMA_URL);
  console.info(`Using AI provider: ollama (${provider.baseUrl})`);
  const ok = await provider.check(model);
  return ok ? provider : undefined;
}

export function runCommandSync(command: string) {
  execSync(command, { stdio: 'inherit', encoding: 'utf8' });
}

export async function askForInput(question: string): Promise<string> {
  return new Promise((resolve, _reject) => {
    const read = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    read.question(question, (answer) => {
      read.close();
      resolve(answer);
    });
  });
}

export async function askForConfirmation(question: string): Promise<boolean> {
  const answer = await askForInput(`${question} [Y/n] `);
  return answer.toLowerCase() !== 'n';
}
