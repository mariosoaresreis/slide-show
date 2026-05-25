# ── Cloud SQL (PostgreSQL 16) ─────────────────────────────────────────────────
resource "google_sql_database_instance" "postgres" {
  name             = "bumble-bff-${var.env}"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = var.db_tier
    availability_type = var.env == "prod" ? "REGIONAL" : "ZONAL"
    disk_autoresize   = true
    disk_size         = 10

    ip_configuration {
      ipv4_enabled    = false      # no public IP — only private via VPC
      private_network = "projects/${var.project_id}/global/networks/default"
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.env == "prod"
      start_time                     = "03:00"
      backup_retention_settings {
        retained_backups = 7
      }
    }

    maintenance_window {
      day          = 7  # Sunday
      hour         = 4
      update_track = "stable"
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  deletion_protection = var.env == "prod"

  depends_on = [google_project_service.apis]
}

resource "google_sql_database" "bumble_bff" {
  name     = "bumble_bff"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "bumble" {
  name     = "bumble"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

output "db_instance_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}
