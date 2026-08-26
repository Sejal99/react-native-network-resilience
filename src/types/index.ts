import type { ConnectivityProvider } from '../connectivity/ConnectivityProvider';
import type { NetworkEventListener } from '../events/NetworkEventListener';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type BackoffStrategy = 'fixed' | 'exponential';

export interface RetryConfig {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export interface RequestConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
}

export interface NetworkClientConfig {
  baseURL?: string;
  timeout?: number;
  retry?: Partial<RetryConfig>;
  deduplication?: boolean;
  connectivityProvider?: ConnectivityProvider;
  waitForConnectivity?: boolean;
  connectivityTimeout?: number;
  onEvent?: NetworkEventListener;
}
