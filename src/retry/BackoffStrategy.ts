export interface BackoffOptions {
  strategy: 'fixed' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export function calculateBackoff(
  attempt: number,
  options: BackoffOptions
): number {
  const baseDelay =
    options.strategy === 'fixed'
      ? options.initialDelay
      : options.initialDelay * Math.pow(2, attempt - 1);

  const delay = Math.min(baseDelay, options.maxDelay);

  if (!options.jitter) {
    return delay;
  }

  return Math.floor(Math.random() * delay);
}
