import { RetryClassifier } from './RetryClassifier';
import { calculateBackoff } from './BackoffStrategy';
import type { RetryConfig } from '../types';
import { NetworkError } from '../errors/NetworkError';

export class RetryPolicy {
  private readonly classifier: RetryClassifier;

  constructor(private readonly config: RetryConfig) {
    this.classifier = new RetryClassifier();
  }

  shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.config.maxAttempts) {
      return false;
    }

    if (error instanceof NetworkError) {
      if (error.code === 'CANCELLED') {
        return false;
      }

      if (error.code === 'TIMEOUT') {
        return true;
      }

      if (error.code === 'NETWORK_ERROR') {
        return true;
      }

      if (error.code === 'HTTP_ERROR') {
        return this.classifier.shouldRetry(error.status);
      }
    }

    return false;
  }

  getDelay(attempt: number): number {
    return calculateBackoff(attempt, {
      strategy: this.config.backoff,
      initialDelay: this.config.initialDelay,
      maxDelay: this.config.maxDelay,
      jitter: this.config.jitter,
    });
  }
}
