import { RequestManager } from '../request/RequestManager';
import type { NetworkClientConfig, RequestConfig } from '../types';
import { RequestRegistry } from '../request/RequestRegistry';
import { createRequestKey } from '../request/createRequestKey';

export class NetworkClient {
  constructor(
    private readonly config: NetworkClientConfig,
    private readonly requestManager: RequestManager,
    private readonly requestRegistry: RequestRegistry
  ) {}

  async get<T>(
    url: string,
    options: Omit<RequestConfig, 'url' | 'method'> = {}
  ): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'GET',
    });
  }

  async post<T>(
    url: string,
    body?: unknown,
    options: Omit<RequestConfig, 'url' | 'method' | 'body'> = {}
  ): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body,
    });
  }

  async put<T>(
    url: string,
    body?: unknown,
    options: Omit<RequestConfig, 'url' | 'method' | 'body'> = {}
  ): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body,
    });
  }

  async patch<T>(
    url: string,
    body?: unknown,
    options: Omit<RequestConfig, 'url' | 'method' | 'body'> = {}
  ): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body,
    });
  }

  async delete<T>(
    url: string,
    options: Omit<RequestConfig, 'url' | 'method'> = {}
  ): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'DELETE',
    });
  }

  private async request<T>(
    url: string,
    config: Omit<RequestConfig, 'url'>
  ): Promise<T> {
    const finalUrl = this.buildUrl(url);

    const requestConfig: RequestConfig = {
      ...config,
      url: finalUrl,
      timeout: config.timeout ?? this.config.timeout,
    };

    const shouldDeduplicate =
      this.config.deduplication === true && requestConfig.method === 'GET';

    if (!shouldDeduplicate) {
      return this.requestManager.execute<T>(requestConfig);
    }

    const key = createRequestKey(requestConfig);

    const existingRequest = this.requestRegistry.get<T>(key);

    if (existingRequest) {
      return existingRequest;
    }

    const request = this.requestManager.execute<T>(requestConfig);

    this.requestRegistry.set(key, request);

    return request;
  }

  private buildUrl(url: string): string {
    if (!this.config.baseURL) {
      return url;
    }

    return `${this.config.baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  }
}
