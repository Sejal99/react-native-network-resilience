export type NetworkEvent =
  | {
      type: 'REQUEST_START';
      requestId: string;
      url: string;
      method: string;
    }
  | {
      type: 'REQUEST_RETRY';
      requestId: string;
      url: string;
      method: string;
      attempt: number;
      delay: number;
    }
  | {
      type: 'REQUEST_SUCCESS';
      requestId: string;
      url: string;
      method: string;
      duration: number;
    }
  | {
      type: 'REQUEST_ERROR';
      requestId: string;
      url: string;
      method: string;
      duration: number;
      error: unknown;
    }
  | {
      type: 'REQUEST_CANCELLED';
      requestId: string;
      url: string;
      method: string;
      duration: number;
    };
