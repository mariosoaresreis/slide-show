import { Component, inject, OnInit, OnDestroy, HostListener, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SlideshowStore } from '../../core/services/slideshow.store';
import { UploadPanelComponent } from '../upload/upload-panel.component';
import { PhotoGridComponent } from './photo-grid.component';
import { environment } from '@env/environment';

@Component({
  selector: 'app-slideshow',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, UploadPanelComponent, PhotoGridComponent],
  template: `
    <div class="slideshow-shell">
      <header class="topbar">
        <div class="topbar-brand">
          <span class="brand-bee">⬡</span>
          <span class="brand-name">bumble</span>
        </div>
        @if (store.profile(); as p) {
          <div class="topbar-meta">
            <span class="meta-name">{{ p.displayName }}</span>
            <span class="meta-count">{{ store.photoCount() }} photo{{ store.photoCount() !== 1 ? 's' : '' }}</span>
          </div>
        }
        <button class="upload-trigger" (click)="showUpload.set(!showUpload())">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Add photo
        </button>
      </header>

      @if (store.error()) {
        <div class="toast toast-error" (click)="store.clearError()">
          <span>{{ store.error() }}</span>
          <button class="toast-close">✕</button>
        </div>
      }

      @if (showUpload()) {
        <app-upload-panel [profileId]="profileId" (close)="showUpload.set(false)" />
      }

      <main class="viewer">
        @if (store.loading()) {
          <div class="skeleton-stage">
            <div class="skeleton-photo shimmer"></div>
            <div class="skeleton-dots">
              <div class="skeleton-dot shimmer"></div>
              <div class="skeleton-dot shimmer"></div>
              <div class="skeleton-dot shimmer"></div>
            </div>
          </div>
        }

        @if (!store.loading() && !store.hasPhotos()) {
          <div class="empty-state">
            <div class="empty-icon">🖼</div>
            <p class="empty-headline">No photos yet</p>
            <p class="empty-sub">Add your first photo to start the slideshow</p>
            <button class="btn-primary" (click)="showUpload.set(true)">Upload a photo</button>
          </div>
        }

        @if (!store.loading() && store.hasPhotos()) {
          <div class="stage" (touchstart)="onTouchStart($event)" (touchend)="onTouchEnd($event)">
            @if (store.activePhoto(); as photo) {
              <div class="photo-frame" [class.transitioning]="transitioning()">
                @if (photo.signedViewUrl) {
                  <img class="photo-img" [src]="photo.signedViewUrl" [alt]="photo.caption ?? 'Photo ' + (store.activeIndex() + 1)" (load)="onImageLoad()" (error)="onImageError()" />
                } @else {
                  <div class="photo-pending">
                    <span class="pending-icon">⏳</span>
                    <span>Processing…</span>
                  </div>
                }

                @if (photo.caption) {
                  <div class="caption-overlay">{{ photo.caption }}</div>
                }

                <button class="delete-btn" (click)="onDelete(photo.id)" title="Delete photo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                </button>

                <div class="meta-chip">
                  @if (photo.width && photo.height) {
                    <span>{{ photo.width }}×{{ photo.height }}</span>
                    <span class="chip-sep">·</span>
                  }
                  <span>{{ store.activeIndex() + 1 }} / {{ store.photoCount() }}</span>
                </div>
              </div>
            }

            <button class="nav-btn nav-prev" [class.hidden]="store.isFirstPhoto()" (click)="goTo('prev')" aria-label="Previous photo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button class="nav-btn nav-next" [class.hidden]="store.isLastPhoto()" (click)="goTo('next')" aria-label="Next photo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div class="dots" role="tablist" aria-label="Photo navigation">
            @for (photo of store.photos(); track photo.id; let i = $index) {
              <button class="dot" [class.active]="i === store.activeIndex()" (click)="store.goTo(i)" [attr.aria-label]="'Photo ' + (i + 1)" role="tab" [attr.aria-selected]="i === store.activeIndex()"></button>
            }
          </div>
        }
      </main>

      @if (!store.loading() && store.hasPhotos()) {
        <section class="grid-section">
          <div class="grid-header">
            <h2 class="grid-title">All photos</h2>
            <span class="grid-hint">Drag to reorder</span>
          </div>
          <app-photo-grid [profileId]="profileId" />
        </section>
      }
    </div>
  `,
  styles: [
    `
    .slideshow-shell {
      min-height: 100vh;
      background: var(--c-bg);
      display: flex;
      flex-direction: column;
    }
    .topbar {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 2rem;
      border-bottom: 1px solid var(--c-border);
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--c-bg);
      backdrop-filter: blur(8px);
    }
    .topbar-brand { display: flex; align-items: center; gap: 8px; margin-right: auto; }
    .brand-bee { font-size: 22px; color: var(--c-yellow); filter: drop-shadow(0 0 6px rgba(255,196,0,.4)); }
    .brand-name { font-family: var(--f-display); font-size: 22px; font-weight: 700; color: var(--c-text); letter-spacing: -.5px; }
    .topbar-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
    .meta-name { font-size: 13px; font-weight: 600; color: var(--c-text); }
    .meta-count { font-size: 11px; color: var(--c-muted); font-family: var(--f-mono); }
    .upload-trigger {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 18px;
      background: var(--c-yellow); color: #1a1a1a;
      border: none; border-radius: 100px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      transition: transform .15s, box-shadow .15s;
      font-family: var(--f-body);
    }
    .upload-trigger svg { width: 15px; height: 15px; }
    .upload-trigger:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(255,196,0,.35); }
    .upload-trigger:active { transform: translateY(0); }
    .toast {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 20px; margin: 8px 2rem 0;
      border-radius: 8px; font-size: 13px; cursor: pointer;
      animation: slideDown .25s ease;
    }
    .toast-error { background: rgba(255,72,72,.12); border: 1px solid rgba(255,72,72,.3); color: #ff7070; }
    .toast-close { background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; }
    .viewer {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem 0;
    }
    .skeleton-stage { display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }
    .skeleton-photo { width: min(520px, 90vw); aspect-ratio: 4/5; border-radius: 20px; }
    .skeleton-dots { display: flex; gap: 8px; }
    .skeleton-dot { width: 8px; height: 8px; border-radius: 50%; }
    .shimmer {
      background: linear-gradient(90deg, var(--c-surface) 25%, var(--c-surface2) 50%, var(--c-surface) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      gap: .75rem; padding: 4rem 2rem; text-align: center;
    }
    .empty-icon { font-size: 48px; margin-bottom: .5rem; opacity: .6; }
    .empty-headline { font-family: var(--f-display); font-size: 24px; font-weight: 700; color: var(--c-text); }
    .empty-sub { font-size: 15px; color: var(--c-muted); }
    .btn-primary {
      margin-top: 1rem; padding: 10px 28px;
      background: var(--c-yellow); color: #1a1a1a;
      border: none; border-radius: 100px;
      font-size: 14px; font-weight: 700; cursor: pointer;
      font-family: var(--f-body);
      transition: transform .15s, box-shadow .15s;
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(255,196,0,.35); }
    .stage {
      position: relative;
      width: min(520px, 90vw);
      user-select: none;
    }
    .photo-frame {
      position: relative;
      border-radius: 20px;
      overflow: hidden;
      background: var(--c-surface);
      box-shadow: 0 24px 64px rgba(0,0,0,.45), 0 4px 16px rgba(0,0,0,.25);
      aspect-ratio: 4/5;
      transition: opacity .25s ease;
    }
    .photo-frame.transitioning { opacity: .6; }
    .photo-img {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
      transition: transform .4s cubic-bezier(.25,.46,.45,.94);
    }
    .photo-img:hover { transform: scale(1.02); }
    .photo-pending {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; height: 100%;
      font-size: 14px; color: var(--c-muted);
    }
    .pending-icon { font-size: 32px; }
    .caption-overlay {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 2rem 1.25rem 1.25rem;
      background: linear-gradient(transparent, rgba(0,0,0,.65));
      font-size: 14px; color: #fff; font-weight: 500;
      letter-spacing: .01em;
    }
    .delete-btn {
      position: absolute; top: 12px; right: 12px;
      width: 36px; height: 36px;
      background: rgba(0,0,0,.45);
      border: none; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .2s;
      backdrop-filter: blur(4px);
    }
    .delete-btn svg { width: 15px; height: 15px; stroke: #fff; }
    .photo-frame:hover .delete-btn { opacity: 1; }
    .delete-btn:hover { background: rgba(220,50,50,.7); }
    .meta-chip {
      position: absolute; top: 12px; left: 12px;
      display: flex; align-items: center; gap: 4px;
      padding: 4px 10px;
      background: rgba(0,0,0,.45);
      border-radius: 100px;
      font-size: 11px; font-family: var(--f-mono);
      color: rgba(255,255,255,.85);
      backdrop-filter: blur(4px);
    }
    .chip-sep { opacity: .5; }
    .nav-btn {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: 44px; height: 44px;
      background: rgba(255,255,255,.1);
      border: 1px solid rgba(255,255,255,.15);
      border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .2s, transform .2s;
      backdrop-filter: blur(8px);
      z-index: 2;
    }
    .nav-btn svg { width: 18px; height: 18px; stroke: #fff; }
    .nav-btn:hover { background: rgba(255,255,255,.2); transform: translateY(-50%) scale(1.08); }
    .nav-btn:active { transform: translateY(-50%) scale(.96); }
    .nav-prev { left: -56px; }
    .nav-next { right: -56px; }
    .nav-btn.hidden { opacity: 0; pointer-events: none; }
    .dots {
      display: flex; gap: 6px;
      justify-content: center;
      padding: 1.5rem 0 .5rem;
    }
    .dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--c-surface2);
      border: none; cursor: pointer;
      transition: background .2s, transform .2s;
      padding: 0;
    }
    .dot.active { background: var(--c-yellow); transform: scale(1.35); }
    .dot:hover:not(.active) { background: var(--c-muted); }
    .grid-section { padding: 1.5rem 2rem 3rem; max-width: 900px; width: 100%; margin: 0 auto; }
    .grid-header { display: flex; align-items: baseline; gap: 1rem; margin-bottom: 1rem; }
    .grid-title { font-family: var(--f-display); font-size: 18px; font-weight: 700; color: var(--c-text); }
    .grid-hint { font-size: 12px; color: var(--c-muted); }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 680px) {
      .topbar { padding: .75rem 1rem; }
      .nav-prev { left: 6px; }
      .nav-next { right: 6px; }
      .grid-section { padding: 1rem; }
    }
  `],
})
export class SlideshowComponent implements OnInit, OnDestroy {
  readonly store = inject(SlideshowStore);
  readonly route = inject(ActivatedRoute);

  profileId = environment.demoProfileId;
  showUpload = signal(false);
  transitioning = signal(false);

  private touchStartX = 0;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('profileId');
    if (id) this.profileId = id;
    this.store.loadProfile(this.profileId);
  }

  ngOnDestroy(): void {}

  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight') this.goTo('next');
    if (e.key === 'ArrowLeft') this.goTo('prev');
  }

  goTo(dir: 'next' | 'prev'): void {
    this.transitioning.set(true);
    setTimeout(() => this.transitioning.set(false), 280);
    dir === 'next' ? this.store.next() : this.store.prev();
  }

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
  }

  onTouchEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(dx) > 50) this.goTo(dx < 0 ? 'next' : 'prev');
  }

  onImageLoad(): void {}
  onImageError(): void {}

  onDelete(photoId: string): void {
    if (confirm('Delete this photo?')) {
      this.store.deletePhoto(this.profileId, photoId);
    }
  }
}

