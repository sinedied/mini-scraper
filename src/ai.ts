import process from 'node:process';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Ollama } from 'ollama';
import createDebug from 'debug';

const debugOllama = createDebug('ai:ollama');
const debugLmStudio = createDebug('ai:lmstudio');
const debugDetect = createDebug('ai:detect');

export type AiProviderName = 'ollama' | 'lmstudio';

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_LMSTUDIO_URL = 'http://localhost:1234/v1';

const PROBE_TIMEOUT_MS = 500;

export type AiCompletion = Record<string, string | undefined> | undefined;

export type AiProvider = {
  name: AiProviderName;
  baseUrl: string;
  check(model: string): Promise<boolean>;
  hasModel(model: string): Promise<boolean>;
  getCompletion(prompt: string, model: string, retryCount?: number): Promise<AiCompletion>;
};

export class OllamaProvider implements AiProvider {
  name: AiProviderName = 'ollama';
  baseUrl: string;
  private readonly client: Ollama;

  constructor(baseUrl: string = DEFAULT_OLLAMA_URL) {
    this.baseUrl = baseUrl;
    this.client = new Ollama({ host: baseUrl });
  }

  async getCompletion(prompt: string, model: string, retryCount = 2): Promise<AiCompletion> {
    debugOllama('Requesting completion for prompt:', prompt);
    const response = await this.client.chat({
      model,
      messages: [{ role: 'user', content: prompt }],
      options: { temperature: 0.3 },
      format: 'json'
    });
    const content = response?.message?.content;

    try {
      return JSON.parse(content) as Record<string, string | undefined>;
    } catch {
      debugOllama('Failed to parse JSON response:', content);
      if (retryCount > 0) {
        debugOllama('Retrying, remaining attempts:', retryCount);
        return this.getCompletion(prompt, model, retryCount - 1);
      }

      return undefined;
    }
  }

  async hasModel(model: string): Promise<boolean> {
    try {
      await this.client.show({ model });
      return true;
    } catch (error: any) {
      if (error?.status_code === 404) return false;
      throw error instanceof Error ? error : new Error(String(error), { cause: error });
    }
  }

  async check(model: string): Promise<boolean> {
    try {
      await this.client.list();
      debugOllama('Ollama is reachable at', this.baseUrl);
    } catch {
      console.error(
        `Ollama is not installed or running, but --ai option is enabled.\nPlease install it from https://ollama.com/download.`
      );
      return false;
    }

    let modelAvailable = false;

    try {
      modelAvailable = await this.hasModel(model);
      if (modelAvailable) debugOllama(`Model "${model}" available`);
    } catch {
      console.error(`Could not connect to Ollama API, please try again.`);
      return false;
    }

    if (!modelAvailable) {
      const confirm = await askForConfirmation(`Model "${model}" not found. Do you want to download it?`);
      if (!confirm) {
        throw new Error(`Model "${model}" is not available.\nPlease run "ollama pull ${model}" to download it.`);
      }

      try {
        console.info(`Downloading model "${model}"...`);
        runCommandSync(`ollama pull ${model}`);
      } catch (error: any) {
        console.error(`Failed to download model "${model}".\n${error.message}`);
        return false;
      }
    }

    return true;
  }
}

export class LmStudioProvider implements AiProvider {
  name: AiProviderName = 'lmstudio';
  baseUrl: string;

  constructor(baseUrl: string = DEFAULT_LMSTUDIO_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getCompletion(prompt: string, model: string, retryCount = 2): Promise<AiCompletion> {
    debugLmStudio('Requesting completion for prompt:', prompt);
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'answer',
            schema: { type: 'object', additionalProperties: true }
          }
        }
      })
    });

    if (!res.ok) {
      const text = await res.text();
      debugLmStudio('LM Studio error response:', res.status, text);
      throw new Error(`LM Studio request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content;

    try {
      return JSON.parse(content ?? '') as Record<string, string | undefined>;
    } catch {
      debugLmStudio('Failed to parse JSON response:', content);
      if (retryCount > 0) {
        debugLmStudio('Retrying, remaining attempts:', retryCount);
        return this.getCompletion(prompt, model, retryCount - 1);
      }

      return undefined;
    }
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models`);
    if (!res.ok) throw new Error(`LM Studio /models returned ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    return (data.data ?? []).map((m) => m.id ?? '').filter(Boolean);
  }

  async hasModel(model: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.includes(model);
    } catch {
      return false;
    }
  }

  async checkDetail(model: string): Promise<{ ok: true } | { ok: false; reason: 'down' | 'missing-model' }> {
    let models: string[];
    try {
      models = await this.listModels();
      debugLmStudio('LM Studio is reachable at', this.baseUrl);
    } catch {
      return { ok: false, reason: 'down' };
    }

    if (!models.includes(model)) return { ok: false, reason: 'missing-model' };
    return { ok: true };
  }

  async check(model: string): Promise<boolean> {
    const result = await this.checkDetail(model);
    if (result.ok) return true;

    if (result.reason === 'down') {
      console.error(
        `LM Studio is not running, but --ai option is enabled.\nDownload it from https://lmstudio.ai/download and start the local server.`
      );
    } else {
      console.error(
        `Model "${model}" is not loaded in LM Studio.\nOpen the app and load the model (LM Studio has no CLI auto-pull).`
      );
    }

    return false;
  }
}

type Probe = {
  up: boolean;
  hasModel: boolean;
};

async function probeOllama(url: string, model: string): Promise<Probe> {
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (!res.ok) return { up: false, hasModel: false };
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    const names = (data.models ?? []).map((m) => m.name ?? '');
    return { up: true, hasModel: names.includes(model) };
  } catch {
    return { up: false, hasModel: false };
  }
}

async function probeLmStudio(url: string, model: string): Promise<Probe> {
  try {
    const res = await fetch(`${url}/models`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (!res.ok) return { up: false, hasModel: false };
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const ids = (data.data ?? []).map((m) => m.id ?? '');
    return { up: true, hasModel: ids.includes(model) };
  } catch {
    return { up: false, hasModel: false };
  }
}

export type DetectInput = {
  model: string;
  forcedProvider?: AiProviderName;
  url?: string;
};

export async function detectProvider(input: DetectInput): Promise<AiProvider | undefined> {
  const { model, forcedProvider, url } = input;

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

  if (url) {
    const provider = new OllamaProvider(url);
    console.info(`Using AI provider: ollama (${provider.baseUrl})`);
    const ok = await provider.check(model);
    return ok ? provider : undefined;
  }

  debugDetect('Probing Ollama and LM Studio in parallel');
  const [ollamaResult, lmStudioResult] = await Promise.allSettled([
    probeOllama(DEFAULT_OLLAMA_URL, model),
    probeLmStudio(DEFAULT_LMSTUDIO_URL, model)
  ]);

  const ollama: Probe = ollamaResult.status === 'fulfilled' ? ollamaResult.value : { up: false, hasModel: false };
  const lmStudio: Probe = lmStudioResult.status === 'fulfilled' ? lmStudioResult.value : { up: false, hasModel: false };
  debugDetect('Probe results — ollama:', ollama, 'lmstudio:', lmStudio);

  if (!ollama.up && !lmStudio.up) {
    console.error(
      'No local AI provider detected. Install one of:\n' +
        '  - Ollama: https://ollama.com/download\n' +
        '  - LM Studio: https://lmstudio.ai/download'
    );
    return undefined;
  }

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
