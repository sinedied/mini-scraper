import process from 'node:process';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import createDebug from 'debug';
import OpenAI from 'openai';

const debug = createDebug('ai');

// Default to Ollama's OpenAI-compatible endpoint, so it works out of the box like before.
export const DEFAULT_AI_URL = 'http://localhost:11434/v1';
// Placeholder key for local providers that don't require authentication (Ollama, LM Studio…).
export const DEFAULT_AI_KEY = 'ollama';

export type AiCompletion = Record<string, string | undefined> | undefined;

export type AiConfig = {
  url: string;
  apiKey: string;
  model: string;
};

export function createAiClient(config: AiConfig): OpenAI {
  return new OpenAI({ baseURL: config.url, apiKey: config.apiKey });
}

export async function getCompletion(
  client: OpenAI,
  prompt: string,
  model: string,
  retryCount = 2
): Promise<AiCompletion> {
  debug('Requesting completion for prompt:', prompt);
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });
  const content = response.choices[0]?.message?.content ?? '';

  try {
    return JSON.parse(content) as Record<string, string | undefined>;
  } catch {
    debug('Failed to parse JSON response:', content);
    if (retryCount > 0) {
      debug('Retrying, remaining attempts:', retryCount);
      return getCompletion(client, prompt, model, retryCount - 1);
    }

    return undefined;
  }
}

export async function checkAi(config: AiConfig): Promise<OpenAI | undefined> {
  const client = createAiClient(config);

  let models: string[];
  try {
    const list = await client.models.list();
    models = list.data.map((m) => m.id);
    debug('AI provider reachable at', config.url, '— available models:', models);
  } catch (error) {
    debug('AI provider unreachable:', error);
    console.error(
      `Could not reach an AI provider at ${config.url}.\n` +
        'Make sure a local provider is running (e.g. Ollama: https://ollama.com/download, ' +
        'LM Studio: https://lmstudio.ai/download), or point to another OpenAI-compatible endpoint with --ai-url.'
    );
    return undefined;
  }

  if (models.length > 0 && !models.includes(config.model) && !(await ensureModel(config))) {
    return undefined;
  }

  return client;
}

// Only Ollama exposes a local CLI to pull models on demand; for any other provider the model
// must already be available server-side, so we just warn and let the request proceed.
async function ensureModel(config: AiConfig): Promise<boolean> {
  if (!isLocalOllama(config.url)) {
    console.warn(
      `Model "${config.model}" is not listed by the AI provider. Continuing anyway; the request may fail if it isn't available.`
    );
    return true;
  }

  const confirm = await askForConfirmation(
    `Model "${config.model}" not found. Do you want to download it with Ollama?`
  );
  if (!confirm) {
    console.error(
      `Model "${config.model}" is not available.\nPlease run "ollama pull ${config.model}" to download it.`
    );
    return false;
  }

  try {
    console.info(`Downloading model "${config.model}"...`);
    runCommandSync(`ollama pull ${config.model}`);
    return true;
  } catch (error: unknown) {
    console.error(
      `Failed to download model "${config.model}".\n${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

function isLocalOllama(url: string): boolean {
  try {
    const { hostname, port } = new URL(url);
    return (hostname === 'localhost' || hostname === '127.0.0.1') && port === '11434';
  } catch {
    return false;
  }
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
