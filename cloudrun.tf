# ── Artifact Registry ─────────────────────────────────────────────────────────
resource "google_artifact_registry_repository" "bff" {
  repository_id = "bumble-bff"
  location      = var.region
  format        = "DOCKER"
  description   = "Bumble BFF Docker images"

  cleanup_policies {
    id     = "keep-last-10"
    action = "KEEP"
    most_recent_versions { keep_count = 10 }
  }

  depends_on = [google_project_service.apis]
}

# ── Service Account for Cloud Run ─────────────────────────────────────────────
resource "google_service_account" "bff_sa" {
  account_id   = "bumble-bff-${var.env}"
  display_name = "Bumble BFF Service Account (${var.env})"
}

resource "google_project_iam_member" "bff_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.bff_sa.email}"
}

resource "google_project_iam_member" "bff_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.bff_sa.email}"
}

resource "google_project_iam_member" "bff_storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.bff_sa.email}"
}

resource "google_project_iam_member" "bff_metrics_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.bff_sa.email}"
}

# ── VPC Access Connector (Cloud Run → Cloud SQL private IP) ───────────────────
resource "google_vpc_access_connector" "bff" {
  name          = "bumble-bff-${var.env}"
  region        = var.region
  machine_type  = "e2-micro"
  min_instances = 2
  max_instances = 3
  network       = "default"
  ip_cidr_range = "10.8.0.0/28"

  depends_on = [google_project_service.apis]
}

# ── Cloud Run Service ─────────────────────────────────────────────────────────
locals {
  image = "${var.region}-docker.pkg.dev/${var.project_id}/bumble-bff/api:${var.image_tag}"
}

resource "google_cloud_run_v2_service" "bff" {
  name     = "bumble-bff-${var.env}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account = google_service_account.bff_sa.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.bff.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      name  = "bff"
      image = local.image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true  # scale CPU to zero when no requests
      }

      # ── Env vars from Secret Manager ─────────────────────────────────────
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "DATABASE_USER"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_user.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "DATABASE_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      # ── Plain env vars ────────────────────────────────────────────────────
      env { name = "GCP_PROJECT_ID";  value = var.project_id }
      env { name = "GCS_BUCKET";      value = google_storage_bucket.photos.name }
      env { name = "JWT_ISSUER";      value = "https://bumble.com" }
      env { name = "JWT_AUDIENCE";    value = "bumble-bff" }
      env { name = "PORT";            value = "8080" }

      # ── Health probes ─────────────────────────────────────────────────────
      liveness_probe {
        http_get {
          path = "/health/live"
          port = 8080
        }
        initial_delay_seconds = 10
        period_seconds        = 15
      }

      startup_probe {
        http_get {
          path = "/health/ready"
          port = 8080
        }
        failure_threshold     = 12
        period_seconds        = 5
        initial_delay_seconds = 5
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,  # managed by CI/CD
    ]
  }

  depends_on = [
    google_project_service.apis,
    google_vpc_access_connector.bff,
  ]
}

# Allow unauthenticated access (JWT validation is in-app)
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.bff.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "cloud_run_url" {
  value = google_cloud_run_v2_service.bff.uri
}
