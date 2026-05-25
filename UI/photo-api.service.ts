import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  PhotoListResponse,
  PhotoResponse,
  UploadPhotoRequest,
  UploadPhotoResponse,
  ReorderPhotosRequest,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class PhotoApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // ── GET /v1/profiles/{profileId}/photos ───────────────────────────────────
  listPhotos(profileId: string): Observable<PhotoListResponse> {
    return this.http.get<PhotoListResponse>(
      `${this.base}/v1/profiles/${profileId}/photos`
    );
  }

  // ── POST /v1/profiles/{profileId}/photos ──────────────────────────────────
  // Step 1: create DB record + get signed upload URL
  initiateUpload(
    profileId: string,
    body: UploadPhotoRequest
  ): Observable<UploadPhotoResponse> {
    return this.http.post<UploadPhotoResponse>(
      `${this.base}/v1/profiles/${profileId}/photos`,
      body
    );
  }

  // Step 2: PUT image bytes directly to the GCS signed URL (no auth header needed)
  uploadToGcs(
    signedUrl: string,
    file: File
  ): Observable<HttpEvent<void>> {
    const req = new HttpRequest<File>('PUT', signedUrl, file, {
      headers: { 'Content-Type': file.type },
      reportProgress: true,
    });
    // We return the raw request so the caller can track progress events
    return this.http.request<void>(req);
  }

  // ── GET /v1/profiles/{profileId}/photos/{photoId} ─────────────────────────
  getPhoto(profileId: string, photoId: string): Observable<PhotoResponse> {
    return this.http.get<PhotoResponse>(
      `${this.base}/v1/profiles/${profileId}/photos/${photoId}`
    );
  }

  // ── DELETE /v1/profiles/{profileId}/photos/{photoId} ─────────────────────
  deletePhoto(profileId: string, photoId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/v1/profiles/${profileId}/photos/${photoId}`
    );
  }

  // ── PUT /v1/profiles/{profileId}/photos/order ─────────────────────────────
  reorderPhotos(
    profileId: string,
    body: ReorderPhotosRequest
  ): Observable<PhotoListResponse> {
    return this.http.put<PhotoListResponse>(
      `${this.base}/v1/profiles/${profileId}/photos/order`,
      body
    );
  }
}
