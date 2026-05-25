resource "google_artifact_registry_repository" "bff" {
  project       = var.project_id
  location      = var.region
  repository_id = "bumble-bff"
  format        = "DOCKER"
  description   = "Container images for the Bumble slideshow BFF"

  depends_on = [google_project_service.artifact_registry_api]
}

resource "google_service_account" "bff" {
  project      = var.project_id
  account_id   = local.service_name
  display_name = "${local.service_name} runtime"

  depends_on = [google_project_service.iam_api]
}

resource "google_cloud_run_v2_service" "bff" {
  name     = local.service_name
  project  = var.project_id
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.bff.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.bff.repository_id}/api:${var.image_tag}"

      ports {
        container_port = 8080
      }

      env {
        name  = "PORT"
        value = "8080"
      }

      resources {
        limits = {
          cpu    = var.container_cpu
          memory = var.container_memory
        }
      }

      startup_probe {
        http_get {
          path = "/health/ready"
          port = 8080
        }
        initial_delay_seconds = 5
        timeout_seconds       = 5
        period_seconds        = 5
        failure_threshold     = 12
      }

      liveness_probe {
        http_get {
          path = "/health/live"
          port = 8080
        }
        initial_delay_seconds = 10
        timeout_seconds       = 5
        period_seconds        = 15
        failure_threshold     = 3
      }
    }
  }

  depends_on = [
    google_project_service.cloud_run_api,
    google_artifact_registry_repository.bff,
    google_service_account.bff,
  ]
}

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

output "artifact_registry_repository" {
  value = google_artifact_registry_repository.bff.id
}

output "cloud_run_service_name" {
  value = google_cloud_run_v2_service.bff.name
}

