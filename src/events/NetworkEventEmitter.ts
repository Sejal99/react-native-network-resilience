import type { NetworkEvent } from './NetworkEvent';
import type { NetworkEventListener } from './NetworkEventListener';

export class NetworkEventEmitter {
  constructor(private readonly listener?: NetworkEventListener) {}

  emit(event: NetworkEvent): void {
    this.listener?.(event);
  }
}
