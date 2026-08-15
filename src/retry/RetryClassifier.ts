export class RetryClassifier {
  shouldRetry(status?: number): boolean {
    if (!status) {
      return true;
    }

    return [408, 429, 500, 502, 503, 504].includes(status);
  }
}
