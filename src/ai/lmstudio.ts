import createDebug from 'debug';
import { type AiCompletion, type AiProvider, type AiProviderName, type Probe, PROBE_TIMEOUT_MS } from '../ai.js';

export const DEFAULT_LMSTUDIO_URL = 'http://localhost:1234/v1';

const debugLmStudio = createDebug('ai:lmstudio');

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

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
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

export async function probeLmStudio(url: string, model: string): Promise<Probe> {
  try {
    const res = await fetch(`${url}/models`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });
    if (!res.ok) return { up: false, hasModel: false };
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const ids = (data.data ?? []).map((m) => m.id ?? '');
    return { up: true, hasModel: ids.includes(model) };
  } catch {
    return { up: false, hasModel: false };
  }
}
