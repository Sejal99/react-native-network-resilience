export interface BackoffOptions {
  initialDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export function calculateBackoff(
  attempt: number,
  options: BackoffOptions
): number {
  const exponentialDelay = options.initialDelay * Math.pow(2, attempt - 1);

  const delay = Math.min(exponentialDelay, options.maxDelay);

  if (!options.jitter) {
    return delay;
  }

  return Math.floor(Math.random() * delay);
}
