// Re-exports the StorageService presigned-URL helpers; kept as a util file so consumers don't
// directly import the storage module here. The actual implementation lives in StorageService.
export type PresignKind = 'put' | 'get';

export interface PresignRequest {
  key: string;
  contentType?: string;
  kind: PresignKind;
  expiresInSeconds?: number;
}

export interface PresignResult {
  url: string;
  key: string;
  headers?: Record<string, string>;
}
