export interface ConnectivityProvider {
  isOnline(): boolean;

  subscribe(listener: (online: boolean) => void): () => void;
}
