variable "project_id" {
  description = "GCP project id that hosts the deployed service."
  type        = string
}

variable "region" {
  description = "Primary GCP region for Artifact Registry and Cloud Run."
  type        = string
}

variable "env" {
  description = "Deployment environment name used in resource naming."
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.env)
    error_message = "env must be either dev or prod."
  }
}

variable "image_tag" {
  description = "Container image tag to deploy to Cloud Run."
  type        = string
}

variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances to keep warm."
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances to scale out to."
  type        = number
  default     = 2
}

variable "container_cpu" {
  description = "CPU limit for the Cloud Run container."
  type        = string
  default     = "1"
}

variable "container_memory" {
  description = "Memory limit for the Cloud Run container."
  type        = string
  default     = "512Mi"
}

