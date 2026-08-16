export interface RequestMetrics {
  requestId: string;
  duration: number;
  attempts: number;
  retries: number;
  success: boolean;
}
