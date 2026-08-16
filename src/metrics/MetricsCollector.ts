import type { NetworkEvent } from '../events/NetworkEvent';
import type { RequestMetrics } from './RequestMetrics';

interface RequestState {
  startedAt: number;
  attempts: number;
  retries: number;
}

export class MetricsCollector {
  private readonly requests = new Map<string, RequestState>();

  private readonly completed: RequestMetrics[] = [];

  handleEvent(event: NetworkEvent): void {
    switch (event.type) {
      case 'REQUEST_START':
        this.requests.set(event.requestId, {
          startedAt: Date.now(),
          attempts: 1,
          retries: 0,
        });
        break;

      case 'REQUEST_RETRY': {
        const state = this.requests.get(event.requestId);

        if (!state) {
          return;
        }

        state.retries += 1;
        state.attempts += 1;
        break;
      }

      case 'REQUEST_SUCCESS':
        this.complete(event.requestId, true, event.duration);
        break;

      case 'REQUEST_ERROR':
        this.complete(event.requestId, false, event.duration);
        break;

      case 'REQUEST_CANCELLED':
        this.complete(event.requestId, false, event.duration);
        break;
    }
  }

  getMetrics(): RequestMetrics[] {
    return [...this.completed];
  }

  private complete(
    requestId: string,
    success: boolean,
    duration: number
  ): void {
    const state = this.requests.get(requestId);

    if (!state) {
      return;
    }

    this.completed.push({
      requestId,
      duration,
      attempts: state.attempts,
      retries: state.retries,
      success,
    });

    this.requests.delete(requestId);
  }
}
