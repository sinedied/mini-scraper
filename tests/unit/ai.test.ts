import { afterEach, describe, expect, test, vi } from 'vitest';
import { checkAi, createAiClient, getCompletion } from '../../src/ai.js';
import { findBestMatch, findBestMatchWithAi } from '../../src/matcher.js';
import { resetStats, stats } from '../../src/stats.js';
import { startMockServices } from '../helpers/mock-services.js';
import { createOptions } from '../helpers/options.js';

const closeServices: Array<() => Promise<void>> = [];

afterEach(async () => {
  const pendingServices = [...closeServices];
  closeServices.length = 0;
  await Promise.all(pendingServices.map(async (close) => close()));
  resetStats();
  vi.restoreAllMocks();
});

describe('OpenAI-compatible integration', () => {
  test('discovers models and propagates authentication', async () => {
    const service = await startMockServices();
    closeServices.push(service.close);

    const client = await checkAi({
      url: service.aiUrl,
      apiKey: 'secret-key',
      model: 'test-model'
    });

    expect(client).toBeDefined();
    expect(service.requests).toContainEqual(
      expect.objectContaining({
        path: '/v1/models',
        authorization: 'Bearer secret-key'
      })
    );
  });

  test('continues with a non-Ollama provider when a model is not listed', async () => {
    const service = await startMockServices();
    closeServices.push(service.close);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const client = await checkAi({
      url: service.aiUrl,
      apiKey: 'test',
      model: 'provider-managed-model'
    });

    expect(client).toBeDefined();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('Continuing anyway'));
  });

  test('returns undefined when the provider cannot be reached', async () => {
    const service = await startMockServices();
    await service.close();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      checkAi({
        url: service.aiUrl,
        apiKey: 'test',
        model: 'test-model'
      })
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Could not reach an AI provider'));
  });

  test('retries malformed JSON completions', async () => {
    const service = await startMockServices({
      completionResponses: ['not-json', { bestMatch: 'Wario Land 3.png' }]
    });
    closeServices.push(service.close);
    const client = createAiClient({
      url: service.aiUrl,
      apiKey: 'test',
      model: 'test-model'
    });

    await expect(getCompletion(client, 'pick a game', 'test-model', 1)).resolves.toEqual({
      bestMatch: 'Wario Land 3.png'
    });
    expect(service.requests.filter(({ path }) => path === '/v1/chat/completions')).toHaveLength(2);
  });

  test('retries candidates not present in the supplied list', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const candidate = 'Pokemon - Silver Version (USA, Europe).png';
    const service = await startMockServices({
      completionResponses: [{ bestMatch: 'invalid.png' }, { bestMatch: candidate }]
    });
    closeServices.push(service.close);
    const client = createAiClient({
      url: service.aiUrl,
      apiKey: 'test',
      model: 'test-model'
    });

    await expect(
      findBestMatchWithAi(
        'Pokemon - Version Argent',
        'Pokemon - Version Argent (France)',
        [candidate],
        createOptions({ ai: true, aiClient: client })
      )
    ).resolves.toBe(candidate);
    expect(stats.matches.ai).toBe(1);
  });

  test('falls back to deterministic matching when the provider returns null', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const candidate = 'Pokemon - Silver Version (USA, Europe).png';
    const service = await startMockServices({
      completionResponses: [{ bestMatch: null }]
    });
    closeServices.push(service.close);
    const client = createAiClient({
      url: service.aiUrl,
      apiKey: 'test',
      model: 'test-model'
    });

    await expect(
      findBestMatch(
        'Pokemon - Silver Version',
        'Pokemon - Version Argent',
        [candidate],
        createOptions({ ai: true, aiClient: client })
      )
    ).resolves.toBe(candidate);
    expect(stats.matches.ai).toBe(0);
    expect(stats.matches.partial).toBe(1);
  });
});
