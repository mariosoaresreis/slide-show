import { Component, Input, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { SlideshowStore } from '../../core/services/slideshow.store';
import { PhotoResponse } from '../../core/models/api.models';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';

@Component({
  selector: 'app-photo-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DragDropModule, FileSizePipe],
  template: `
    <div
      class="grid"
      cdkDropList
      cdkDropListOrientation="horizontal"
      [cdkDropListData]="store.photos()"
      (cdkDropListDropped)="onDrop($event)"
    >
      @for (photo of store.photos(); track photo.id; let i = $index) {
        <div
          class="grid-item"
          [class.active]="i === store.activeIndex()"
          [class.uploading]="photo.status === 'PROCESSING'"
          cdkDrag
          [cdkDragData]="photo"
          (click)="store.goTo(i)"
          [attr.aria-label]="'Select photo ' + (i + 1)"
        >
          @if (photo.signedViewUrl) {
            <img class="thumb" [src]="photo.signedViewUrl" [alt]="photo.caption ?? 'Photo ' + (i + 1)" loading="lazy" />
          } @else {
            <div class="thumb-placeholder">
              <span>⏳</span>
            </div>
          }

          <div class="active-ring"></div>
          <span class="order-badge">{{ i + 1 }}</span>

          <div class="drag-handle" cdkDragHandle aria-label="Drag to reorder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="5" r="1" fill="currentColor"/>
              <circle cx="15" cy="5" r="1" fill="currentColor"/>
              <circle cx="9" cy="12" r="1" fill="currentColor"/>
              <circle cx="15" cy="12" r="1" fill="currentColor"/>
              <circle cx="9" cy="19" r="1" fill="currentColor"/>
              <circle cx="15" cy="19" r="1" fill="currentColor"/>
            </svg>
          </div>

          <div *cdkDragPlaceholder class="drag-placeholder"></div>
        </div>
      }

      @if (store.reordering()) {
        <div class="reorder-indicator">Saving order…</div>
      }
    </div>
  `,
  styles: [
    `
    .grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      min-height: 100px;
    }

    .grid-item {
      position: relative;
      width: 100px; height: 100px;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      flex-shrink: 0;
      border: 2px solid transparent;
      transition: border-color .2s, transform .2s, box-shadow .2s;
    }
    .grid-item:hover { transform: scale(1.04); box-shadow: 0 8px 20px rgba(0,0,0,.35); }
    .grid-item.active { border-color: var(--c-yellow); }
    .grid-item.active .active-ring { opacity: 1; }

    .thumb {
      width: 100%; height: 100%;
      object-fit: cover; display: block;
    }
    .thumb-placeholder {
      width: 100%; height: 100%;
      background: var(--c-surface2);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px;
    }

    .active-ring {
      position: absolute; inset: 0;
      border-radius: 10px;
      box-shadow: inset 0 0 0 2px var(--c-yellow);
      opacity: 0;
      pointer-events: none;
    }

    .order-badge {
      position: absolute; top: 5px; left: 5px;
      width: 20px; height: 20px;
      background: rgba(0,0,0,.6);
      border-radius: 50%;
      font-size: 10px; font-family: var(--f-mono);
      color: #fff; display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(4px);
    }

    .drag-handle {
      position: absolute; bottom: 4px; right: 4px;
      width: 22px; height: 22px;
      background: rgba(0,0,0,.55);
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .2s;
      cursor: grab;
      backdrop-filter: blur(4px);
    }
    .drag-handle svg { width: 13px; height: 13px; stroke: #fff; }
    .grid-item:hover .drag-handle { opacity: 1; }

    .drag-placeholder {
      width: 100px; height: 100px;
      border-radius: 12px;
      background: var(--c-surface2);
      border: 2px dashed var(--c-border);
    }

    :host ::ng-deep .cdk-drag-preview {
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 16px 40px rgba(0,0,0,.5);
      opacity: .92;
      transform: rotate(3deg) scale(1.06);
    }
    :host ::ng-deep .cdk-drag-animating {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }

    .reorder-indicator {
      display: flex; align-items: center;
      font-size: 12px; color: var(--c-yellow);
      font-family: var(--f-mono);
      padding: 0 8px;
    }
  `
  ],
})
export class PhotoGridComponent {
  @Input() profileId!: string;
  readonly store = inject(SlideshowStore);

  onDrop(event: CdkDragDrop<PhotoResponse[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const photos = [...this.store.photos()];
    moveItemInArray(photos, event.previousIndex, event.currentIndex);
    const orderedIds = photos.map(p => p.id);
    this.store.reorderPhotos(this.profileId, orderedIds);
  }
}

