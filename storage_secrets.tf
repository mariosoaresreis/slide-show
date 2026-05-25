# ── GCS Photo Bucket ─────────────────────────────────────────────────────────
resource "google_storage_bucket" "photos" {
  name                        = "bumble-photos-${var.env}-${var.project_id}"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"  # no public access — signed URLs only

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action { type = "Delete" }
    condition {
      age                = 1
      with_state         = "ARCHIVED"  # clean up old versions after 1 day
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "PUT", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Authorization", "x-goog-*"]
    max_age_seconds = 3600
  }
}

# ── Secret Manager ────────────────────────────────────────────────────────────
resource "google_secret_manager_secret" "db_url" {
  secret_id = "bumble-bff-${var.env}-db-url"
  replication { auto {} }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "db_url" {
  secret = google_secret_manager_secret.db_url.id
  secret_data = "jdbc:postgresql:///${google_sql_database.bumble_bff.name}?cloudSqlInstance=${google_sql_database_instance.postgres.connection_name}&socketFactory=com.google.cloud.sql.postgres.SocketFactory&ipTypes=PRIVATE"
}

resource "google_secret_manager_secret" "db_user" {
  secret_id = "bumble-bff-${var.env}-db-user"
  replication { auto {} }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "db_user" {
  secret      = google_secret_manager_secret.db_user.id
  secret_data = google_sql_user.bumble.name
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "bumble-bff-${var.env}-db-password"
  replication { auto {} }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "bumble-bff-${var.env}-jwt-secret"
  replication { auto {} }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

output "photos_bucket" {
  value = google_storage_bucket.photos.name
}
