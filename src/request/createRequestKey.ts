import type { RequestConfig } from '../types';

export function createRequestKey(config: RequestConfig): string {
  const body = config.body !== undefined ? JSON.stringify(config.body) : '';

  return [config.method, config.url, body].join(':');
}
