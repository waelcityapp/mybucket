/**
 * Abstract Storage Provider Contract
 * 
 * Strict Constraint: Firebase Storage is NOT used.
 * All file storage is decoupled behind this provider interface, allowing
 * any future storage provider (GCS, AWS S3, Cloudflare R2, custom API)
 * to be plugged in without modifying application domain logic or coupling to Firebase Storage.
 */

export interface StorageUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
}

export interface StorageUploadResult {
  fileId: string;
  storagePath: string;
  publicUrl?: string;
  sizeBytes: number;
  contentType: string;
  uploadedAt: string;
  providerName: string;
}

export interface FileMetadata {
  fileId: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
  providerMetadata?: Record<string, unknown>;
}

export interface IStorageProvider {
  readonly name: string;
  readonly isEnabled: boolean;
  
  /**
   * Uploads binary or blob data using the configured external provider.
   */
  upload(
    file: Blob | Uint8Array,
    path: string,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult>;

  /**
   * Generates or retrieves a secure download URL for the target path.
   */
  getDownloadUrl(storagePath: string): Promise<string>;

  /**
   * Removes a file by its storage path.
   */
  delete(storagePath: string): Promise<void>;

  /**
   * Retrieves metadata for a file.
   */
  getMetadata(storagePath: string): Promise<FileMetadata>;
}
