import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PhotoApiService } from '@core/services/photo-api.service';
import { PhotoListResponse } from '@core/models/api.models';
import { environment } from '@env/environment';

describe('PhotoApiService', () => {
  let service: PhotoApiService;
  let http: HttpTestingController;

  const PROFILE_ID = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PhotoApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(PhotoApiService);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should list photos', () => {
    const mock: PhotoListResponse = { photos: [], total: 0 };

    service.listPhotos(PROFILE_ID).subscribe(res => {
      expect(res.total).toBe(0);
      expect(res.photos).toEqual([]);
    });

    const req = http.expectOne(`${environment.apiBaseUrl}/v1/profiles/${PROFILE_ID}/photos`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
  });

  it('should initiate upload', () => {
    const mockRes = {
      photoId: 'abc-123',
      signedUploadUrl: 'https://storage.googleapis.com/bucket/obj?sig=x',
      uploadExpiresAt: new Date().toISOString(),
    };

    service.initiateUpload(PROFILE_ID, {
      filename: 'test.jpg',
      contentType: 'image/jpeg',
    }).subscribe(res => {
      expect(res.photoId).toBe('abc-123');
      expect(res.signedUploadUrl).toContain('storage.googleapis.com');
    });

    const req = http.expectOne(`${environment.apiBaseUrl}/v1/profiles/${PROFILE_ID}/photos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.filename).toBe('test.jpg');
    req.flush(mockRes);
  });

  it('should delete a photo', () => {
    const PHOTO_ID = 'photo-uuid-001';

    service.deletePhoto(PROFILE_ID, PHOTO_ID).subscribe();

    const req = http.expectOne(
      `${environment.apiBaseUrl}/v1/profiles/${PROFILE_ID}/photos/${PHOTO_ID}`
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('should reorder photos', () => {
    const orderedIds = ['id-1', 'id-2', 'id-3'];
    const mockRes: PhotoListResponse = { photos: [], total: 0 };

    service.reorderPhotos(PROFILE_ID, { orderedPhotoIds: orderedIds }).subscribe();

    const req = http.expectOne(
      `${environment.apiBaseUrl}/v1/profiles/${PROFILE_ID}/photos/order`
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.orderedPhotoIds).toEqual(orderedIds);
    req.flush(mockRes);
  });
});
