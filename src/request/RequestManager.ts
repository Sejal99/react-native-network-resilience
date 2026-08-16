import type { HttpTransport } from '../transport/HttpTransport';
import { RetryPolicy } from '../retry/RetryPolicy';
import type { RequestConfig } from '../types';
import type { ConnectivityProvider } from '../connectivity/ConnectivityProvider';
import { waitForConnectivity } from '../connectivity/waitForConnectivity';

export class RequestManager {
  constructor(
    private readonly transport: HttpTransport,
    private readonly retryPolicy: RetryPolicy,
    private readonly connectivityProvider?: ConnectivityProvider,
    private readonly waitForNetwork = false
  ) {}

  async execute<T>(config: RequestConfig): Promise<T> {
    if (
      this.waitForNetwork &&
      this.connectivityProvider &&
      !this.connectivityProvider.isOnline()
    ) {
      await waitForConnectivity(this.connectivityProvider);
    }

    let attempt = 1;

    while (true) {
      try {
        return await this.transport.request<T>(config);
      } catch (error) {
        if (!this.retryPolicy.shouldRetry(error, attempt)) {
          throw error;
        }

        const delay = this.retryPolicy.getDelay(attempt);

        await this.sleep(delay);

        attempt++;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
