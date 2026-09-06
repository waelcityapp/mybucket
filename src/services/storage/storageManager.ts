import { IStorageProvider, StorageUploadOptions, StorageUploadResult, FileMetadata } from './types';

/**
 * Disabled/Null Storage Provider
 * Enforces the strict constraint: No Firebase Storage.
 * Directs all application records to structured Firestore documents.
 */
export class DisabledStorageProvider implements IStorageProvider {
  readonly name = 'Disabled (Structured-Only Phase)';
  readonly isEnabled = false;

  async upload(_file: Blob | Uint8Array, _path: string, _options?: StorageUploadOptions): Promise<StorageUploadResult> {
    throw new Error(
      'Storage constraint violation: File storage is currently disabled in this phase. ' +
      'All data must remain structured documents in Firestore. Firebase Storage is strictly forbidden.'
    );
  }

  async getDownloadUrl(_storagePath: string): Promise<string> {
    throw new Error('File storage is disabled: no remote file download URLs are available.');
  }

  async delete(_storagePath: string): Promise<void> {
    throw new Error('File storage is disabled: no remote file operations permitted.');
  }

  async getMetadata(_storagePath: string): Promise<FileMetadata> {
    throw new Error('File storage is disabled.');
  }
}

/**
 * Memory Storage Provider (for local sandbox testing only if needed)
 * Completely independent of any cloud storage vendor or Firebase Storage.
 */
export class InMemoryStorageProvider implements IStorageProvider {
  readonly name = 'In-Memory Abstract Provider (Sandbox)';
  readonly isEnabled = true;
  private storage = new Map<string, { data: Uint8Array; contentType: string; size: number; date: string }>();

  async upload(file: Blob | Uint8Array, path: string, options?: StorageUploadOptions): Promise<StorageUploadResult> {
    let bytes: Uint8Array;
    if (file instanceof Blob) {
      const buffer = await file.arrayBuffer();
      bytes = new Uint8Array(buffer);
    } else {
      bytes = file;
    }

    const contentType = options?.contentType || 'application/octet-stream';
    const now = new Date().toISOString();
    this.storage.set(path, {
      data: bytes,
      contentType,
      size: bytes.byteLength,
      date: now,
    });

    return {
      fileId: `mem_${Math.random().toString(36).substring(2, 9)}`,
      storagePath: path,
      publicUrl: `blob:mock/${encodeURIComponent(path)}`,
      sizeBytes: bytes.byteLength,
      contentType,
      uploadedAt: now,
      providerName: this.name,
    };
  }

  async getDownloadUrl(storagePath: string): Promise<string> {
    if (!this.storage.has(storagePath)) {
      throw new Error(`File not found: ${storagePath}`);
    }
    return `blob:mock/${encodeURIComponent(storagePath)}`;
  }

  async delete(storagePath: string): Promise<void> {
    this.storage.delete(storagePath);
  }

  async getMetadata(storagePath: string): Promise<FileMetadata> {
    const item = this.storage.get(storagePath);
    if (!item) {
      throw new Error(`File not found: ${storagePath}`);
    }
    return {
      fileId: `mem_${storagePath}`,
      name: storagePath.split('/').pop() || storagePath,
      sizeBytes: item.size,
      contentType: item.contentType,
      createdAt: item.date,
      updatedAt: item.date,
    };
  }
}

/**
 * Storage Service Registry
 * Decouples client components from any specific storage vendor.
 */
class StorageService {
  private activeProvider: IStorageProvider = new DisabledStorageProvider();
  private availableProviders = new Map<string, IStorageProvider>();

  constructor() {
    this.registerProvider(this.activeProvider);
    this.registerProvider(new InMemoryStorageProvider());
  }

  public registerProvider(provider: IStorageProvider) {
    this.availableProviders.set(provider.name, provider);
  }

  public setProvider(providerName: string) {
    const provider = this.availableProviders.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found in registry.`);
    }
    this.activeProvider = provider;
  }

  public getProvider(): IStorageProvider {
    return this.activeProvider;
  }

  public getAvailableProviderNames(): string[] {
    return Array.from(this.availableProviders.keys());
  }

  public isStorageEnabled(): boolean {
    return this.activeProvider.isEnabled;
  }
}

export const storageService = new StorageService();
