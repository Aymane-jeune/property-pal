export type UserRole = 'admin' | 'agent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type DocumentCategory = 'contract' | 'property-photo' | 'client-file' | 'condition-report' | 'supplier-contract';

export interface FileRecord {
  id: string;
  fileName: string;
  category: DocumentCategory;
  cloudPath: string;
  uploadedBy: string;
  fileSize: string;
  createdAt: string;
}
