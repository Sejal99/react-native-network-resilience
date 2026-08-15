import type { HttpTransport } from './HttpTransport';
import type { RequestConfig } from '../types';
import { NetworkError } from '../errors/NetworkError';

export class FetchTransport implements HttpTransport {
  async request<T>(config: RequestConfig): Promise<T> {
    const controller = new AbortController();

    let timedOut = false;

    const timeoutId = config.timeout
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, config.timeout)
      : undefined;

    const abortListener = () => {
      controller.abort();
    };

    config.signal?.addEventListener('abort', abortListener);

    try {
      console.log('🌐 ACTUAL NETWORK REQUEST:', config.method, config.url);
      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new NetworkError(
          `HTTP request failed with status ${response.status}`,
          {
            code: 'HTTP_ERROR',
            status: response.status,
            url: config.url,
          }
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      // Already normalized by us
      if (error instanceof NetworkError) {
        throw error;
      }

      // User explicitly cancelled the request
      if (config.signal?.aborted) {
        throw new NetworkError('Request was cancelled', {
          code: 'CANCELLED',
          url: config.url,
        });
      }

      // Our timeout triggered the AbortController
      if (timedOut) {
        throw new NetworkError('Request timed out', {
          code: 'TIMEOUT',
          url: config.url,
        });
      }

      // Other network/fetch failures
      throw new NetworkError('Network request failed', {
        code: 'NETWORK_ERROR',
        url: config.url,
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      config.signal?.removeEventListener('abort', abortListener);
    }
  }
}
