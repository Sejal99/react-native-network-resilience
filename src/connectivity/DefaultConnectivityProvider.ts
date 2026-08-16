import type { ConnectivityProvider } from './ConnectivityProvider';

export class DefaultConnectivityProvider implements ConnectivityProvider {
  private online = true;

  private readonly listeners = new Set<(online: boolean) => void>();

  isOnline(): boolean {
    return this.online;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  setOnline(online: boolean): void {
    if (this.online === online) {
      return;
    }

    this.online = online;

    this.listeners.forEach((listener) => {
      listener(online);
    });
  }
}
