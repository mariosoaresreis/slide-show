import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpHeaders, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  PhotoListResponse,
  PhotoResponse,
  ReorderPhotosRequest,
  UploadPhotoRequest,
  UploadPhotoResponse,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class PhotoApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  listPhotos(profileId: string): Observable<PhotoListResponse> {
    return this.http.get<PhotoListResponse>(`${this.base}/v1/profiles/${profileId}/photos`);
  }

  initiateUpload(profileId: string, body: UploadPhotoRequest): Observable<UploadPhotoResponse> {
    return this.http.post<UploadPhotoResponse>(`${this.base}/v1/profiles/${profileId}/photos`, body);
  }

  uploadToGcs(signedUrl: string, file: File): Observable<HttpEvent<void>> {
    const req = new HttpRequest<File>('PUT', signedUrl, file, {
      headers: new HttpHeaders({ 'Content-Type': file.type }),
      reportProgress: true,
    });
    return this.http.request<void>(req);
  }

  getPhoto(profileId: string, photoId: string): Observable<PhotoResponse> {
    return this.http.get<PhotoResponse>(`${this.base}/v1/profiles/${profileId}/photos/${photoId}`);
  }

  deletePhoto(profileId: string, photoId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/v1/profiles/${profileId}/photos/${photoId}`);
  }

  reorderPhotos(profileId: string, body: ReorderPhotosRequest): Observable<PhotoListResponse> {
    return this.http.put<PhotoListResponse>(`${this.base}/v1/profiles/${profileId}/photos/order`, body);
  }
}


