import { RequestManager } from '../request/RequestManager';
import type { NetworkClientConfig, RequestConfig } from '../types';
import { RequestRegistry } from '../request/RequestRegistry';
import { createRequestKey } from '../request/createRequestKey';
import type { ConnectivityProvider } from '../connectivity/ConnectivityProvider';
import { OfflineQueue } from '../queue/OfflineQueue';

export class NetworkClient {
  constructor(
    private readonly config: NetworkClientConfig,
    private readonly requestManager: RequestManager,
    private readonly requestRegistry: RequestRegistry,
    private readonly connectivityProvider?: ConnectivityProvider,
    private readonly offlineQueue?: OfflineQueue
  ) {}

  getMetrics() {
    return this.requestManager.getMetrics();
  }

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

    /*
     * V2 OFFLINE QUEUE
     *
     * Only queue when:
     * 1. Queue is configured
     * 2. Connectivity provider exists
     * 3. Device is offline
     *
     * GET requests are intentionally not queued yet.
     * We will define the queue policy separately.
     */
    if (
      this.offlineQueue &&
      this.connectivityProvider &&
      !this.connectivityProvider.isOnline() &&
      requestConfig.method !== 'GET'
    ) {
      this.offlineQueue.add(requestConfig);

      throw new Error('Request queued because device is offline');
    }

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
    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    if (!this.config.baseURL) {
      return url;
    }

    return `${this.config.baseURL.replace(/\/$/, '')}/${url.replace(
      /^\//,
      ''
    )}`;
  }
}
