import type { HttpTransport } from '../transport/HttpTransport';
import { RetryPolicy } from '../retry/RetryPolicy';
import type { RequestConfig } from '../types';

export class RequestManager {
  constructor(
    private readonly transport: HttpTransport,
    private readonly retryPolicy: RetryPolicy
  ) {}

  async execute<T>(config: RequestConfig): Promise<T> {
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

  //   private getStatus(error: unknown): number | undefined {
  //     if (
  //       typeof error === 'object' &&
  //       error !== null &&
  //       'status' in error &&
  //       typeof error.status === 'number'
  //     ) {
  //       return error.status;
  //     }

  //     return undefined;
  //   }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
