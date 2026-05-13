import createDebug from 'debug';
import { Ollama } from 'ollama';
import {
  type AiCompletion,
  type AiProvider,
  type AiProviderName,
  askForConfirmation,
  type Probe,
  PROBE_TIMEOUT_MS,
  runCommandSync
} from '../ai.js';

const debugOllama = createDebug('ai:ollama');
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

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

export async function probeOllama(url: string, model: string): Promise<Probe> {
  try {
    const res = await fetch(`${url}/api/tags`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });
    if (!res.ok) return { up: false, hasModel: false };
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    const names = (data.models ?? []).map((m) => m.name ?? '');
    return { up: true, hasModel: names.includes(model) };
  } catch {
    return { up: false, hasModel: false };
  }
}
