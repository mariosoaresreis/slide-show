import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { catchError, EMPTY, switchMap, tap } from 'rxjs';
import { PhotoApiService } from './photo-api.service';
import { ProfileApiService } from './profile-api.service';
import {
  PhotoResponse,
  ProfileResponse,
  UploadState,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class SlideshowStore {
  private readonly photoApi    = inject(PhotoApiService);
  private readonly profileApi  = inject(ProfileApiService);

  // ── State signals ─────────────────────────────────────────────────────────
  readonly profile       = signal<ProfileResponse | null>(null);
  readonly photos        = signal<PhotoResponse[]>([]);
  readonly loading       = signal<boolean>(false);
  readonly error         = signal<string | null>(null);
  readonly activeIndex   = signal<number>(0);
  readonly uploads       = signal<UploadState[]>([]);
  readonly reordering    = signal<boolean>(false);

  // ── Derived signals ───────────────────────────────────────────────────────
  readonly activePhoto   = computed(() => this.photos()[this.activeIndex()] ?? null);
  readonly photoCount    = computed(() => this.photos().length);
  readonly hasPhotos     = computed(() => this.photos().length > 0);
  readonly isFirstPhoto  = computed(() => this.activeIndex() === 0);
  readonly isLastPhoto   = computed(() => this.activeIndex() === this.photos().length - 1);
  readonly activeUploads = computed(() => this.uploads().filter(u => u.status === 'uploading'));

  // ── Load profile + photos ─────────────────────────────────────────────────
  loadProfile(profileId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.profileApi.getProfile(profileId).subscribe({
      next: profile => this.profile.set(profile),
      error: err => this.error.set(err.message),
    });

    this.photoApi.listPhotos(profileId).subscribe({
      next: res => {
        this.photos.set(res.photos.filter(p => p.status === 'ACTIVE'));
        this.activeIndex.set(0);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  // ── Slideshow navigation ──────────────────────────────────────────────────
  next(): void {
    if (!this.isLastPhoto()) {
      this.activeIndex.update(i => i + 1);
    }
  }

  prev(): void {
    if (!this.isFirstPhoto()) {
      this.activeIndex.update(i => i - 1);
    }
  }

  goTo(index: number): void {
    if (index >= 0 && index < this.photoCount()) {
      this.activeIndex.set(index);
    }
  }

  // ── Upload: 2-step (initiate → GCS PUT) ──────────────────────────────────
  uploadPhoto(profileId: string, file: File, caption?: string): void {
    const preview = URL.createObjectURL(file);
    const uploadState: UploadState = {
      file,
      preview,
      progress: 0,
      status: 'pending',
    };

    this.uploads.update(list => [...list, uploadState]);
    const idx = this.uploads().length - 1;

    const updateUpload = (patch: Partial<UploadState>) => {
      this.uploads.update(list =>
        list.map((u, i) => (i === idx ? { ...u, ...patch } : u))
      );
    };

    const contentType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';

    // Step 1 — get signed URL from BFF
    this.photoApi
      .initiateUpload(profileId, {
        filename: file.name,
        contentType,
        caption: caption ?? null,
      })
      .pipe(
        tap(() => updateUpload({ status: 'uploading', progress: 5 })),
        switchMap(res => {
          updateUpload({ photoId: res.photoId, progress: 10 });
          // Step 2 — PUT bytes directly to GCS (progress tracked)
          return this.photoApi.uploadToGcs(res.signedUploadUrl, file).pipe(
            tap(event => {
              if (event.type === HttpEventType.UploadProgress && event.total) {
                const pct = Math.round((event.loaded / event.total) * 90) + 10;
                updateUpload({ progress: pct });
              }
              if (event.type === HttpEventType.Response) {
                updateUpload({ status: 'done', progress: 100 });
                // Reload photos to get the new ACTIVE photo with signed view URL
                this.loadProfile(profileId);
              }
            }),
            catchError(err => {
              updateUpload({ status: 'error', errorMessage: err.message });
              return EMPTY;
            })
          );
        }),
        catchError(err => {
          updateUpload({ status: 'error', errorMessage: err.message });
          return EMPTY;
        })
      )
      .subscribe();
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  deletePhoto(profileId: string, photoId: string): void {
    this.photoApi.deletePhoto(profileId, photoId).subscribe({
      next: () => {
        this.photos.update(list => list.filter(p => p.id !== photoId));
        if (this.activeIndex() >= this.photoCount()) {
          this.activeIndex.update(i => Math.max(0, i - 1));
        }
      },
      error: err => this.error.set(err.message),
    });
  }

  // ── Reorder ───────────────────────────────────────────────────────────────
  reorderPhotos(profileId: string, orderedIds: string[]): void {
    this.reordering.set(true);
    // Optimistic update
    const current = this.photos();
    const reordered = orderedIds
      .map(id => current.find(p => p.id === id))
      .filter((p): p is PhotoResponse => !!p);
    this.photos.set(reordered);

    this.photoApi
      .reorderPhotos(profileId, { orderedPhotoIds: orderedIds })
      .subscribe({
        next: res => {
          this.photos.set(res.photos.filter(p => p.status === 'ACTIVE'));
          this.reordering.set(false);
        },
        error: err => {
          // Rollback optimistic update
          this.photos.set(current);
          this.error.set(err.message);
          this.reordering.set(false);
        },
      });
  }

  dismissUpload(index: number): void {
    this.uploads.update(list => list.filter((_, i) => i !== index));
  }

  clearError(): void {
    this.error.set(null);
  }
}
