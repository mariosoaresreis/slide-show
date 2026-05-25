# Bumble Photo Slideshow — Angular Frontend

Angular 17 frontend for the Bumble Photo Slideshow BFF.
Uses standalone components, Angular Signals, and CDK Drag-and-Drop.

## Stack

- **Angular 17** — standalone components, `@angular/core` signals
- **Angular CDK** — drag-and-drop photo reordering
- **RxJS 7** — HTTP streams and upload progress events
- **Angular Animations** — slide-in panels, transitions
- **TypeScript strict mode** — 100% typed against OpenAPI models

## Project structure

```
src/
├── app/
│   ├── app.component.ts            ← Root shell with router outlet
│   ├── app.config.ts               ← HTTP + router + animations providers
│   ├── app.routes.ts               ← Demo route + profile route
│   ├── core/
│   │   ├── interceptors/auth.interceptor.ts
│   │   ├── models/api.models.ts
│   │   └── services/
│   │       ├── auth.service.ts
│   │       ├── photo-api.service.ts
│   │       ├── profile-api.service.ts
│   │       └── slideshow.store.ts
│   ├── features/
│   │   ├── slideshow/
│   │   │   ├── slideshow.component.ts
│   │   │   └── photo-grid.component.ts
│   │   └── upload/
│   │       └── upload-panel.component.ts
│   └── shared/
│       └── pipes/file-size.pipe.ts
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
├── index.html
├── main.ts
└── styles.scss
```

## Running locally

The canonical full-stack startup instructions are documented once in `README.md` at the repository root (see `Golden path`).

### Frontend-only development

### Prerequisites
- Node.js 20+
- BFF running at `http://localhost:8080`

### Install and start
```bash
npm install
npm start
# → http://localhost:4200
```

The dev server proxies `/api` to `http://localhost:8080`. In Docker mode, nginx proxies `/api` to the Compose `bff` service.

### Run tests
```bash
npm test
```

### Build for production
```bash
npm run build:prod
# → dist/bumble-slideshow/
```

## Upload flow

The app implements the BFF's 2-step upload:

1. `POST /v1/profiles/{id}/photos` — BFF creates DB record, returns signed GCS PUT URL
2. `PUT <signedUploadUrl>` — client PUTs image bytes directly to GCS (progress tracked via `HttpEventType.UploadProgress`)
3. After upload, `loadProfile()` is called to refresh the photo list with a fresh signed view URL

## Keyboard & touch navigation

| Input | Action |
|-------|--------|
| `→` arrow key | Next photo |
| `←` arrow key | Previous photo |
| Swipe left (touch) | Next photo |
| Swipe right (touch) | Previous photo |
| Click dot | Go to photo |

## Photo reordering

Drag thumbnails in the grid below the slideshow. On drop:
1. Optimistic update (instant UI feedback)
2. `PUT /v1/profiles/{id}/photos/order` — persists new order to BFF
3. On error, optimistic update is rolled back

## Environment configuration

| File | Used when |
|------|-----------|
| `environment.ts` | `ng serve` / `ng build --configuration development` |
| `environment.prod.ts` | `ng build` (default = production) |

`apiBaseUrl` defaults to `/api` so the frontend can sit behind a reverse proxy in local Docker Compose. If you deploy the frontend separately, change that value to your BFF origin or add a production file replacement.
