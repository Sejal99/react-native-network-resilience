import type { RequestConfig } from '../types';

export interface HttpTransport {
  request<T>(config: RequestConfig): Promise<T>;
}
