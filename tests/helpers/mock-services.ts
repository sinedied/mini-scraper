import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { encode } from 'fast-png';

export type RecordedRequest = {
  method: string;
  path: string;
  authorization?: string;
  body: string;
};

type Completion = string | Record<string, unknown>;

export async function startMockServices({
  artworkNames = ['Wario Land 3 (World) (En,Ja).png'],
  completionResponses = [{ bestMatch: artworkNames[0] }]
}: {
  artworkNames?: string[];
  completionResponses?: Completion[];
} = {}) {
  const requests: RecordedRequest[] = [];
  const png = encode({
    width: 2,
    height: 2,
    channels: 4,
    depth: 8,
    data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
  });
  let completionIndex = 0;

  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.message : String(error));
    });
  });

  async function handleRequest(request: IncomingMessage, response: ServerResponse) {
    const body = await readBody(request);
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    const path = decodeURIComponent(requestUrl.pathname);
    requests.push({
      method: request.method ?? 'GET',
      path,
      authorization: request.headers.authorization,
      body
    });

    if (path === '/v1/models') {
      sendJson(response, {
        object: 'list',
        data: [{ id: 'test-model', object: 'model', created: 0, owned_by: 'tests' }]
      });
      return;
    }

    if (path === '/v1/chat/completions') {
      const completion = completionResponses[Math.min(completionIndex, completionResponses.length - 1)];
      completionIndex++;
      sendJson(response, {
        id: `completion-${completionIndex}`,
        object: 'chat.completion',
        created: 0,
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: typeof completion === 'string' ? completion : JSON.stringify(completion)
            },
            finish_reason: 'stop'
          }
        ]
      });
      return;
    }

    if (path.endsWith('/Named_Boxarts/')) {
      response.setHeader('content-type', 'text/html');
      response.end(artworkNames.map((name) => `<a href="${encodeURIComponent(name)}">${name}</a>`).join('\n'));
      return;
    }

    if (path.endsWith('/malformed.png')) {
      response.setHeader('content-type', 'image/png');
      response.end(Buffer.concat([Buffer.from(png), Buffer.from('trailing-data')]));
      return;
    }

    if (path.endsWith('.png')) {
      response.setHeader('content-type', 'image/png');
      response.end(Buffer.from(png));
      return;
    }

    response.statusCode = 404;
    response.end('Not found');
  }

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Mock server did not bind to a TCP port');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    aiUrl: `${baseUrl}/v1`,
    requests,
    async close() {
      server.close();
      await once(server, 'close');
    }
  };
}

async function readBody(request: IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(response: ServerResponse, value: unknown) {
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(value));
}
