import type { ConnectivityProvider } from './ConnectivityProvider';

export function waitForConnectivity(
  provider: ConnectivityProvider
): Promise<void> {
  if (provider.isOnline()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const unsubscribe = provider.subscribe((online) => {
      if (!online) {
        return;
      }

      unsubscribe();
      resolve();
    });
  });
}
