import type { App } from 'vue';

export function installErrorHandler(app: App): void {
  app.config.errorHandler = (err, _instance, info) => {
    if (import.meta.env.DEV) {
      console.error('[vue:error]', err, info);
    }
    void reportError(err, info);
  };

  window.addEventListener('unhandledrejection', (event) => {
    void reportError(event.reason, 'unhandledrejection');
  });
}

async function reportError(err: unknown, info: string): Promise<void> {
  const error = err instanceof Error ? err : new Error(String(err));
  try {
    await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack ?? '',
        info,
        route: window.location.pathname,
        userAgent: navigator.userAgent,
      }),
    });
  } catch {
    // swallow — error reporting must not throw
  }
}
