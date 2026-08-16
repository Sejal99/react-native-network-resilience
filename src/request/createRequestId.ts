let requestCounter = 0;

export function createRequestId(): string {
  requestCounter += 1;

  return `request-${requestCounter}`;
}
