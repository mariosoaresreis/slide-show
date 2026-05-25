import { Component, Input, Output, EventEmitter, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlideshowStore } from '../../core/services/slideshow.store';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';

@Component({
  selector: 'app-upload-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, FileSizePipe],
  template: `
    <aside class="panel-overlay" (click)="onOverlayClick($event)">
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Add photos</h2>
          <button class="close-btn" (click)="close.emit()" aria-label="Close">✕</button>
        </div>

        <div
          class="drop-zone"
          [class.drag-over]="isDragOver()"
          (dragover)="onDragOver($event)"
          (dragleave)="isDragOver.set(false)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
        >
          <div class="drop-icon">
            <svg viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.5" opacity=".3"/>
              <path d="M24 32V20M18 26l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 34h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <p class="drop-headline">Drop photos here</p>
          <p class="drop-sub">or click to browse · JPEG, PNG, WebP</p>
          <input #fileInput type="file" accept="image/jpeg,image/png,image/webp" multiple class="file-input" (change)="onFileChange($event)" />
        </div>

        <div class="field">
          <label class="field-label" for="caption">Caption (optional)</label>
          <input id="caption" type="text" class="field-input" [(ngModel)]="caption" placeholder="Add a caption…" maxlength="200" />
          <span class="field-count">{{ caption.length }}/200</span>
        </div>

        @if (pendingFiles().length > 0) {
          <div class="queue">
            <p class="queue-label">Ready to upload ({{ pendingFiles().length }})</p>
            @for (file of pendingFiles(); track file.name) {
              <div class="queue-item">
                <img class="queue-thumb" [src]="filePreview(file)" alt="preview" />
                <div class="queue-info">
                  <span class="queue-name">{{ file.name }}</span>
                  <span class="queue-size">{{ file.size | fileSize }}</span>
                </div>
                <button class="queue-remove" (click)="removeFile(file)">✕</button>
              </div>
            }
            <button class="btn-upload" (click)="startUpload()" [disabled]="uploading()">
              @if (uploading()) {
                <span class="spinner"></span> Uploading…
              } @else {
                Upload {{ pendingFiles().length }} photo{{ pendingFiles().length > 1 ? 's' : '' }}
              }
            </button>
          </div>
        }

        @if (store.uploads().length > 0) {
          <div class="uploads-list">
            <p class="queue-label">Uploads</p>
            @for (upload of store.uploads(); track upload.file.name; let i = $index) {
              <div class="upload-item" [class.done]="upload.status === 'done'" [class.error]="upload.status === 'error'">
                <img class="queue-thumb" [src]="upload.preview" alt="preview" />
                <div class="upload-info">
                  <span class="queue-name">{{ upload.file.name }}</span>
                  @if (upload.status === 'uploading') {
                    <div class="progress-track"><div class="progress-fill" [style.width.%]="upload.progress"></div></div>
                    <span class="progress-pct">{{ upload.progress }}%</span>
                  }
                  @if (upload.status === 'done') {
                    <span class="status-done">✓ Uploaded</span>
                  }
                  @if (upload.status === 'error') {
                    <span class="status-error">✗ {{ upload.errorMessage }}</span>
                  }
                </div>
                @if (upload.status === 'done' || upload.status === 'error') {
                  <button class="queue-remove" (click)="store.dismissUpload(i)">✕</button>
                }
              </div>
            }
          </div>
        }
      </div>
    </aside>
  `,
  styles: [
    `
    .panel-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.55);
      z-index: 200;
      display: flex; align-items: flex-end; justify-content: flex-end;
      animation: fadeIn .2s ease;
      backdrop-filter: blur(4px);
    }
    .panel {
      width: min(420px, 100vw);
      height: calc(100vh - 64px);
      background: var(--c-bg);
      border-left: 1px solid var(--c-border);
      border-top: 1px solid var(--c-border);
      border-top-left-radius: 20px;
      display: flex; flex-direction: column; gap: 1.25rem;
      padding: 1.5rem;
      overflow-y: auto;
      animation: slideInRight .25s cubic-bezier(.25,.46,.45,.94);
    }
    .panel-header { display: flex; align-items: center; justify-content: space-between; }
    .panel-title { font-family: var(--f-display); font-size: 20px; font-weight: 700; color: var(--c-text); }
    .close-btn {
      width: 32px; height: 32px;
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: 50%; cursor: pointer;
      font-size: 13px; color: var(--c-muted);
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
    }
    .close-btn:hover { background: var(--c-surface2); color: var(--c-text); }

    .drop-zone {
      border: 2px dashed var(--c-border);
      border-radius: 16px;
      padding: 2rem 1rem;
      display: flex; flex-direction: column; align-items: center; gap: .5rem;
      cursor: pointer; transition: border-color .2s, background .2s;
      text-align: center;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: var(--c-yellow);
      background: rgba(255,196,0,.04);
    }
    .drop-icon svg { width: 48px; height: 48px; color: var(--c-yellow); }
    .drop-headline { font-size: 15px; font-weight: 600; color: var(--c-text); }
    .drop-sub { font-size: 12px; color: var(--c-muted); }
    .file-input { display: none; }

    .field { display: flex; flex-direction: column; gap: 6px; position: relative; }
    .field-label { font-size: 12px; font-weight: 600; color: var(--c-muted); text-transform: uppercase; letter-spacing: .06em; }
    .field-input {
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 14px; color: var(--c-text);
      font-family: var(--f-body);
      outline: none; transition: border-color .15s;
    }
    .field-input:focus { border-color: var(--c-yellow); }
    .field-count { font-size: 11px; color: var(--c-muted); text-align: right; font-family: var(--f-mono); }

    .queue, .uploads-list { display: flex; flex-direction: column; gap: .6rem; }
    .queue-label { font-size: 11px; font-weight: 700; color: var(--c-muted); text-transform: uppercase; letter-spacing: .08em; }
    .queue-item, .upload-item {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px;
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: 10px;
    }
    .upload-item.done { border-color: rgba(72,200,120,.3); }
    .upload-item.error { border-color: rgba(255,72,72,.3); }
    .queue-thumb { width: 40px; height: 40px; border-radius: 7px; object-fit: cover; flex-shrink: 0; }
    .queue-info, .upload-info { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .queue-name { font-size: 12px; font-weight: 500; color: var(--c-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .queue-size { font-size: 11px; color: var(--c-muted); font-family: var(--f-mono); }
    .queue-remove {
      background: none; border: none; color: var(--c-muted);
      cursor: pointer; font-size: 12px; padding: 4px;
      transition: color .15s; flex-shrink: 0;
    }
    .queue-remove:hover { color: var(--c-text); }

    .progress-track {
      height: 3px; background: var(--c-surface2);
      border-radius: 2px; overflow: hidden;
    }
    .progress-fill {
      height: 100%; background: var(--c-yellow);
      border-radius: 2px;
      transition: width .3s ease;
    }
    .progress-pct { font-size: 10px; color: var(--c-yellow); font-family: var(--f-mono); }
    .status-done { font-size: 11px; color: #48c878; }
    .status-error { font-size: 11px; color: #ff7070; }

    .btn-upload {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 12px;
      background: var(--c-yellow); color: #1a1a1a;
      border: none; border-radius: 12px;
      font-size: 14px; font-weight: 700; cursor: pointer;
      font-family: var(--f-body);
      transition: opacity .15s, transform .15s;
      margin-top: .25rem;
    }
    .btn-upload:disabled { opacity: .6; cursor: not-allowed; }
    .btn-upload:not(:disabled):hover { transform: translateY(-1px); }

    .spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(0,0,0,.2);
      border-top-color: #1a1a1a;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class UploadPanelComponent {
  @Input() profileId!: string;
  @Output() close = new EventEmitter<void>();

  readonly store = inject(SlideshowStore);

  caption = '';
  pendingFiles = signal<File[]>([]);
  uploading = signal(false);
  isDragOver = signal(false);

  private previews = new Map<File, string>();

  filePreview(file: File): string {
    if (!this.previews.has(file)) {
      this.previews.set(file, URL.createObjectURL(file));
    }
    return this.previews.get(file)!;
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver.set(true);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver.set(false);
    const files = Array.from(e.dataTransfer?.files ?? []).filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
    this.pendingFiles.update(list => [...list, ...files]);
  }

  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.pendingFiles.update(list => [...list, ...files]);
    input.value = '';
  }

  removeFile(file: File): void {
    this.previews.delete(file);
    this.pendingFiles.update(list => list.filter(f => f !== file));
  }

  startUpload(): void {
    if (!this.pendingFiles().length) return;
    this.uploading.set(true);

    for (const file of this.pendingFiles()) {
      this.store.uploadPhoto(this.profileId, file, this.caption || undefined);
    }

    this.pendingFiles.set([]);
    this.previews.clear();
    this.caption = '';
    this.uploading.set(false);
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('panel-overlay')) {
      this.close.emit();
    }
  }
}

