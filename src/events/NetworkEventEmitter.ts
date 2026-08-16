import type { NetworkEvent } from './NetworkEvent';
import type { NetworkEventListener } from './NetworkEventListener';
import { MetricsCollector } from '../metrics/MetricsCollector';

export class NetworkEventEmitter {
  private readonly metricsCollector: MetricsCollector;

  constructor(private readonly listener?: NetworkEventListener) {
    this.metricsCollector = new MetricsCollector();
  }

  emit(event: NetworkEvent): void {
    this.metricsCollector.handleEvent(event);

    this.listener?.(event);
  }

  getMetrics() {
    return this.metricsCollector.getMetrics();
  }
}
