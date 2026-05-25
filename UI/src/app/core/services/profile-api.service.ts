import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { HealthResponse, ProfileResponse } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getProfile(profileId: string): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.base}/v1/profiles/${profileId}`);
  }

  getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.base}/health/ready`);
  }
}

