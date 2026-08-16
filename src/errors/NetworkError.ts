export type NetworkErrorCode =
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'HTTP_ERROR'
  | 'CANCELLED'
  | 'MAX_RETRIES_EXCEEDED'
  | 'NETWORK_UNAVAILABLE';

export class NetworkError extends Error {
  readonly code: NetworkErrorCode;
  readonly status?: number;
  readonly url?: string;
  readonly attempt?: number;

  constructor(
    message: string,
    options: {
      code: NetworkErrorCode;
      status?: number;
      url?: string;
      attempt?: number;
    }
  ) {
    super(message);

    this.name = 'NetworkError';
    this.code = options.code;
    this.status = options.status;
    this.url = options.url;
    this.attempt = options.attempt;
  }
}
