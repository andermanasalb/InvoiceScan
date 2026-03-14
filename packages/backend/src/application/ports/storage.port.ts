export interface StoredFile {
  key: string; // UUID-based key used to retrieve the file
  mimeType: string;
  sizeBytes: number;
}

export interface StoragePort {
  save(buffer: Buffer, mimeType: string): Promise<StoredFile>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
