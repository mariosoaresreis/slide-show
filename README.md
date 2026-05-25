# Bumble Photo Slideshow BFF

<!-- CI/CD pipeline ready: Terraform-managed infrastructure on GCP Cloud Run -->

A production-grade **Backend-for-Frontend** built with Ktor 2.3, OpenAPI 3.1, and deployed on GCP Cloud Run via Terraform.

## Architecture

```
Mobile / Web clients
       │
       ▼
┌──────────────────────────────┐
│  Ktor 2.3 BFF  (Cloud Run)  │
│  ─────────────────────────  │
│  JWT Auth · Rate Limit       │
│  OpenAPI routes + Swagger    │
│  Signed GCS URL generation   │
└──────┬────────────┬──────────┘
       │            │
       ▼            ▼
 Cloud SQL PG    GCS Bucket
 (Exposed ORM)  (photo storage)
 HikariCP pool  Signed URLs only
```

**Key design decision — signed URL flow:**
The BFF never handles raw image bytes. It generates a v4 signed PUT URL, returns it to the client, and the client uploads directly to GCS. This keeps BFF memory usage flat regardless of photo size.

```
Client → POST /v1/profiles/{id}/photos
       ← { signedUploadUrl, photoId }
Client → PUT signedUploadUrl (binary bytes, direct to GCS)
Client → GET /v1/profiles/{id}/photos  (BFF generates signed GET URLs)
```

## Local development

### Golden path (single source of truth)

### Prerequisites
- Docker + Docker Compose
- Python 3 (used by smoke scripts)

### Start the full stack
```bash
docker compose up --build
```

- UI: `http://localhost:4200`
- BFF: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/docs`

### End-to-end smoke check (startup + upload flow)
```bash
./scripts/compose_smoke_upload.sh
```

This script builds and starts Compose, verifies health, runs a signed upload flow (`POST -> OPTIONS -> PUT -> GET`), and tears everything down.

### Smoke-check a deployed Cloud Run URL
```bash
bash ./scripts/cloud_smoke_upload.sh https://YOUR_CLOUD_RUN_URL
```

### Run without Docker (needs local Postgres)
```bash
export DATABASE_URL=jdbc:postgresql://localhost:5432/bumble_bff
export DATABASE_USER=bumble
export DATABASE_PASSWORD=bumble
export JWT_SECRET=dev-secret-change-in-prod-min-32-chars!!
export GCS_BUCKET=bumble-photos-dev

gradle run
```

### Generate OpenAPI models + client
```bash
gradle openApiGenerate
# → build/generated/openapi/src/main/kotlin/com/bumble/bff/generated/
```

### Run tests
```bash
gradle test
```

## CI checks

GitHub Actions workflow: `.github/workflows/ci.yml`

- Backend build + health smoke
- Frontend production build
- Compose smoke with upload flow

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health/live` | Liveness probe |
| `GET`  | `/health/ready` | Readiness probe (checks DB) |
| `GET`  | `/v1/profiles/{profileId}` | Profile + primary photo URL |
| `GET`  | `/v1/profiles/{profileId}/photos` | Ordered photo list for slideshow |
| `POST` | `/v1/profiles/{profileId}/photos` | Initiate upload → signed PUT URL |
| `GET`  | `/v1/profiles/{profileId}/photos/{photoId}` | Single photo with signed view URL |
| `PUT`  | `/v1/profiles/{profileId}/photos/order` | Reorder slideshow photos |
| `DELETE` | `/v1/profiles/{profileId}/photos/{photoId}` | Delete photo |

All endpoints except health require `Authorization: Bearer <jwt>`.

## GCP Deployment

### One-time setup
```bash
# Create Terraform state bucket
gsutil mb -p YOUR_PROJECT_ID gs://bumble-bff-tfstate

# Enable APIs + provision infra
cd infra
terraform init -backend-config="bucket=bumble-bff-tfstate" -backend-config="prefix=terraform/dev"
terraform apply -var-file="envs/dev/terraform.tfvars" -var="project_id=YOUR_PROJECT_ID" -var="image_tag=latest"
```

### CI/CD (GitHub Actions)
Push to `main` → test → Terraform validate → Terraform bootstrap of Artifact Registry → build Docker → push image → `terraform apply` on dev → deployed smoke test → manual approval → prod → deployed smoke test.

Requires GitHub secrets:
- `GCP_PROJECT_ID`
- `WIF_PROVIDER` — Workload Identity Federation provider
- `WIF_SERVICE_ACCOUNT` — SA email with AR + Cloud Run permissions
- `TF_STATE_BUCKET` — GCS bucket used by the Terraform backend
- `WIF_PROVIDER_PROD` and `WIF_SERVICE_ACCOUNT_PROD` for the production apply job

## Project structure

```
bumble-bff/
├── api/
│   └── openapi.yaml              # Contract-first OpenAPI 3.1 spec
├── src/main/kotlin/com/bumble/bff/
│   ├── Application.kt            # Entry point
│   ├── config/AppConfig.kt       # Typed config (Hoplite)
│   ├── plugins/                  # Ktor plugin installers
│   │   ├── Database.kt           # HikariCP + Exposed + Flyway
│   │   ├── Security.kt           # JWT auth
│   │   ├── Swagger.kt            # Swagger UI at /docs
│   │   └── Plugins.kt            # All other plugins + DI wiring
│   ├── model/Models.kt           # Exposed tables + domain + DTOs
│   ├── repository/               # Data access (Exposed)
│   ├── service/                  # Business logic + GCS
│   └── routes/                   # Ktor routing DSL + OpenAPI annotations
├── src/main/resources/
│   ├── application.yaml          # Default config (env vars override)
│   └── db/migration/             # Flyway SQL migrations
├── infra/                        # Terraform
│   ├── main.tf                   # Provider + API enablement
│   ├── cloudrun.tf               # Cloud Run + VPC + SA
│   ├── cloudsql.tf               # PostgreSQL 16
│   ├── storage_secrets.tf        # GCS bucket + Secret Manager
│   ├── variables.tf
│   └── envs/{dev,prod}/          # Environment-specific tfvars
├── .github/workflows/
│   ├── ci.yml                     # Build + smoke checks
│   └── deploy.yml                 # CI/CD deployment pipeline
├── Dockerfile
├── docker-compose.yml
├── scripts/
│   └── compose_smoke_upload.sh    # local/CI upload flow smoke test
├── UI/                           # Angular 17 frontend
│   ├── Dockerfile                # nginx-served SPA container
│   ├── nginx.conf                # /api proxy to the BFF container
│   └── src/                      # Angular app source
└── build.gradle.kts
```
