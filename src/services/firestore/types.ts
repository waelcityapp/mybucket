/**
 * Structured Firestore Data Architecture
 * 
 * Rules:
 * 1. All application state is persisted as structured documents and collections.
 * 2. Documents adhere strictly to Firestore document limits (< 1MB) and contain no raw file blobs.
 * 3. File attachments (if future external providers are introduced) store only remote string URLs 
 *    or provider storage paths, never direct binary content or Firebase Storage references.
 */

export interface FirestoreDocumentRecord {
  id: string;
  collection: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface AppDataSchema {
  name: string;
  collectionPath: string;
  description: string;
  fields: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'timestamp' | 'map' | 'array';
    required: boolean;
    description: string;
  }[];
}

export const CORE_STRUCTURED_SCHEMAS: AppDataSchema[] = [
  {
    name: 'Application Settings',
    collectionPath: 'settings',
    description: 'Global system configuration and operational switches.',
    fields: [
      { name: 'appName', type: 'string', required: true, description: 'Application display name' },
      { name: 'theme', type: 'string', required: true, description: 'UI theme mode (light/dark)' },
      { name: 'storagePolicy', type: 'string', required: true, description: 'Active storage policy (e.g. structured_firestore_only)' },
      { name: 'updatedAt', type: 'timestamp', required: true, description: 'Server timestamp of update' },
    ],
  },
  {
    name: 'Structured Entity Records',
    collectionPath: 'records',
    description: 'Core application entity documents structured with native Firestore data types.',
    fields: [
      { name: 'title', type: 'string', required: true, description: 'Entity title or label' },
      { name: 'category', type: 'string', required: true, description: 'Categorization tag' },
      { name: 'attributes', type: 'map', required: false, description: 'Key-value structured properties' },
      { name: 'tags', type: 'array', required: false, description: 'Indexed tag list for filtering' },
      { name: 'createdAt', type: 'timestamp', required: true, description: 'Server creation timestamp' },
    ],
  },
  {
    name: 'Audit & Event Logs',
    collectionPath: 'audit_logs',
    description: 'Immutable transaction and event audit trail in Firestore.',
    fields: [
      { name: 'action', type: 'string', required: true, description: 'Action code or event key' },
      { name: 'actorId', type: 'string', required: true, description: 'UID of user or system process' },
      { name: 'details', type: 'map', required: true, description: 'Event payload details' },
      { name: 'timestamp', type: 'timestamp', required: true, description: 'Event occurrence timestamp' },
    ],
  },
];
