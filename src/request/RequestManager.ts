import type { HttpTransport } from '../transport/HttpTransport';
import { RetryPolicy } from '../retry/RetryPolicy';
import type { RequestConfig } from '../types';
import type { ConnectivityProvider } from '../connectivity/ConnectivityProvider';
import { waitForConnectivity } from '../connectivity/waitForConnectivity';
import { NetworkEventEmitter } from '../events/NetworkEventEmitter';
import { createRequestId } from './createRequestId';
import { CancellationManager } from '../cancellation/CancellationManager';

export class RequestManager {
  constructor(
    private readonly transport: HttpTransport,
    private readonly retryPolicy: RetryPolicy,
    private readonly connectivityProvider?: ConnectivityProvider,
    private readonly waitForNetwork = false,
    private readonly connectivityTimeout = 30000,
    private readonly eventEmitter?: NetworkEventEmitter,
    private readonly cancellationManager?: CancellationManager
  ) {}

  getMetrics() {
    return this.eventEmitter?.getMetrics() ?? [];
  }

  async execute<T>(config: RequestConfig): Promise<T> {
    const requestId = createRequestId();
    const startTime = Date.now();

    const controller = new AbortController();

    this.cancellationManager?.register(requestId, controller);

    const externalSignal = config.signal;

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', () => controller.abort());
      }
    }

    const transportConfig: RequestConfig = {
      ...config,
      signal: controller.signal,
    };

    this.eventEmitter?.emit({
      type: 'REQUEST_START',
      requestId,
      url: config.url,
      method: config.method,
    });

    try {
      if (
        this.waitForNetwork &&
        this.connectivityProvider &&
        !this.connectivityProvider.isOnline()
      ) {
        await waitForConnectivity(
          this.connectivityProvider,
          this.connectivityTimeout
        );
      }

      let attempt = 1;

      while (true) {
        try {
          const result = await this.transport.request<T>(transportConfig);

          this.eventEmitter?.emit({
            type: 'REQUEST_SUCCESS',
            requestId,
            url: config.url,
            method: config.method,
            duration: Date.now() - startTime,
          });

          return result;
        } catch (error) {
          // User cancelled the request.
          // Cancellation must NEVER be retried.
          if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'CANCELLED'
          ) {
            throw error;
          }

          // Check whether this error should be retried.
          if (!this.retryPolicy.shouldRetry(error, attempt)) {
            throw error;
          }

          const delay = this.retryPolicy.getDelay(attempt);

          this.eventEmitter?.emit({
            type: 'REQUEST_RETRY',
            requestId,
            url: config.url,
            method: config.method,
            attempt,
            delay,
          });

          await this.sleep(delay);

          attempt++;
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'CANCELLED'
      ) {
        this.eventEmitter?.emit({
          type: 'REQUEST_CANCELLED',
          requestId,
          url: config.url,
          method: config.method,
          duration,
        });
      } else {
        this.eventEmitter?.emit({
          type: 'REQUEST_ERROR',
          requestId,
          url: config.url,
          method: config.method,
          duration,
          error,
        });
      }

      throw error;
    } finally {
      this.cancellationManager?.unregister(requestId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
