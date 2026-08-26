import { NetworkClient } from './NetworkClient';
import { RequestManager } from '../request/RequestManager';
import { FetchTransport } from '../transport/FetchTransport';
import { RetryPolicy } from '../retry/RetryPolicy';
import type { NetworkClientConfig } from '../types';
import { RequestRegistry } from '../request/RequestRegistry';
import { NetInfoConnectivityProvider } from '../connectivity/NetInfoConnectivityProvider';
import { NetworkEventEmitter } from '../events/NetworkEventEmitter';
import { OfflineQueue } from '../queue/OfflineQueue';
import { QueueProcessor } from '../queue/QueueProcessor';
import { CancellationManager } from '../cancellation/CancellationManager';

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

  const eventEmitter = new NetworkEventEmitter(config.onEvent);

  const retryPolicy = new RetryPolicy(retryConfig);

  const cancellationManager = new CancellationManager();

  const requestManager = new RequestManager(
    transport,
    retryPolicy,
    connectivityProvider,
    config.waitForConnectivity ?? false,
    config.connectivityTimeout ?? 30000,
    eventEmitter,
    cancellationManager
  );

  const requestRegistry = new RequestRegistry();

  // V2 Offline Queue
  const offlineQueue = new OfflineQueue();

  const queueProcessor = new QueueProcessor(
    offlineQueue,
    requestManager,
    connectivityProvider
  );

  // Start listening for connectivity restoration
  queueProcessor.start();

  return new NetworkClient(
    config,
    requestManager,
    requestRegistry,
    connectivityProvider,
    offlineQueue,
    cancellationManager
  );
}
