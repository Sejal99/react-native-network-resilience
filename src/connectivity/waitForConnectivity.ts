import type { ConnectivityProvider } from './ConnectivityProvider';
import { NetworkError } from '../errors/NetworkError';

export function waitForConnectivity(
  provider: ConnectivityProvider,
  timeout = 30000
): Promise<void> {
  if (provider.isOnline()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let finished = false;

    const unsubscribe = provider.subscribe((online) => {
      if (!online || finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutId);
      unsubscribe();

      resolve();
    });

    const timeoutId = setTimeout(() => {
      if (finished) {
        return;
      }

      finished = true;
      unsubscribe();

      reject(
        new NetworkError('Network unavailable: connectivity timeout', {
          code: 'NETWORK_UNAVAILABLE',
        })
      );
    }, timeout);
  });
}
