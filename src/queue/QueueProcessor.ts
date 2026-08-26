import type { ConnectivityProvider } from '../connectivity/ConnectivityProvider';
import { RequestManager } from '../request/RequestManager';
import { OfflineQueue } from './OfflineQueue';

export class QueueProcessor {
  private processing = false;

  constructor(
    private readonly queue: OfflineQueue,
    private readonly requestManager: RequestManager,
    private readonly connectivityProvider: ConnectivityProvider
  ) {}

  start(): () => void {
    return this.connectivityProvider.subscribe((online) => {
      if (online) {
        // eslint-disable-next-line no-void
        void this.process();
      }
    });
  }

  async process(): Promise<void> {
    if (this.processing || !this.connectivityProvider.isOnline()) {
      return;
    }

    this.processing = true;

    try {
      const requests = this.queue.getAll();

      for (const request of requests) {
        if (!this.connectivityProvider.isOnline()) {
          break;
        }

        try {
          await this.requestManager.execute(request.config);

          this.queue.remove(request.id);
        } catch {
          // Keep the request in the queue.
          // RequestManager handles retry logic.
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
