import { NetworkClient } from './NetworkClient';
import { RequestManager } from '../request/RequestManager';
import { FetchTransport } from '../transport/FetchTransport';
import { RetryPolicy } from '../retry/RetryPolicy';
import type { NetworkClientConfig } from '../types';
import { RequestRegistry } from '../request/RequestRegistry';
import { NetInfoConnectivityProvider } from '../connectivity/NetInfoConnectivityProvider';

const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  backoff: 'exponential' as const,
  initialDelay: 1000,
  maxDelay: 10000,
  jitter: true,
};

export function createNetworkClient(
  config: NetworkClientConfig = {}
): NetworkClient {
  const retryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config.retry,
  };

  const transport = new FetchTransport();
  const connectivityProvider =
    config.connectivityProvider ?? new NetInfoConnectivityProvider();

  const retryPolicy = new RetryPolicy(retryConfig);

  const requestManager = new RequestManager(
    transport,
    retryPolicy,
    connectivityProvider,
    config.waitForConnectivity ?? false,
    config.connectivityTimeout ?? 30000
  );

  const requestRegistry = new RequestRegistry();

  return new NetworkClient(config, requestManager, requestRegistry);
}
