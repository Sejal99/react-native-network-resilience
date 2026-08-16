import NetInfo, {
  type NetInfoSubscription,
} from '@react-native-community/netinfo';

import type { ConnectivityProvider } from './ConnectivityProvider';

export class NetInfoConnectivityProvider implements ConnectivityProvider {
  private online = true;

  private readonly listeners = new Set<(online: boolean) => void>();

  private unsubscribeNetInfo?: NetInfoSubscription;

  constructor() {
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      this.online =
        state.isConnected === true && state.isInternetReachable !== false;

      this.listeners.forEach((listener) => {
        listener(this.online);
      });
    });
  }

  isOnline(): boolean {
    return this.online;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    this.unsubscribeNetInfo?.();
    this.unsubscribeNetInfo = undefined;
    this.listeners.clear();
  }
}
