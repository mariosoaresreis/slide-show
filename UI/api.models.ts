// ── Enums ─────────────────────────────────────────────────────────────────────
export type PhotoStatus = 'PENDING_UPLOAD' | 'PROCESSING' | 'ACTIVE' | 'DELETED';
export type HealthStatus = 'UP' | 'DOWN' | 'DEGRADED';

// ── Photo ─────────────────────────────────────────────────────────────────────
export interface PhotoResponse {
  id: string;
  profileId: string;
  signedViewUrl: string | null;
  urlExpiresAt: string | null;
  status: PhotoStatus;
  sortOrder: number;
  caption: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface PhotoListResponse {
  photos: PhotoResponse[];
  total: number;
}

export interface UploadPhotoRequest {
  filename: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  caption?: string | null;
  sortOrder?: number | null;
}

export interface UploadPhotoResponse {
  photoId: string;
  signedUploadUrl: string;
  uploadExpiresAt: string;
}

export interface ReorderPhotosRequest {
  orderedPhotoIds: string[];
}

// ── Profile ───────────────────────────────────────────────────────────────────
export interface ProfileResponse {
  id: string;
  displayName: string;
  primaryPhotoUrl: string | null;
  photoCount: number;
  createdAt: string;
}

// ── Health ────────────────────────────────────────────────────────────────────
export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  checks: Record<string, string>;
}

// ── Errors ────────────────────────────────────────────────────────────────────
export interface ErrorResponse {
  error: string;
  message: string;
  details?: string[];
}

// ── UI state helpers (not from API) ──────────────────────────────────────────
export interface UploadState {
  file: File;
  preview: string;        // object URL for preview
  progress: number;       // 0–100
  status: 'pending' | 'uploading' | 'done' | 'error';
  photoId?: string;
  errorMessage?: string;
}
