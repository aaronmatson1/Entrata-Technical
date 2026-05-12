import type { VercelResponse } from '@vercel/node';

/**
 * Q14: server-sent events for staged loading.
 * Stages: wikipedia → generating → validating → done | error.
 */
export interface SSEStream {
  send(event: { stage: string; payload?: unknown; error?: string }): void;
  close(): void;
}

export function openSSE(res: VercelResponse): SSEStream {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const ping = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 15000);

  return {
    send(event) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    },
    close() {
      clearInterval(ping);
      res.end();
    },
  };
}
