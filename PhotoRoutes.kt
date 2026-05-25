package com.bumble.bff.routes

import com.bumble.bff.model.*
import com.bumble.bff.plugins.AUTH_JWT
import com.bumble.bff.service.PhotoService
import io.github.smiley4.ktorswaggerui.dsl.routing.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.util.UUID

fun Route.photoRoutes(photoService: PhotoService) {

    authenticate(AUTH_JWT) {

        // ── GET /v1/profiles/{profileId}/photos ─────────────────────────────
        get("/v1/profiles/{profileId}/photos", {
            tags("photos")
            summary("List all photos ordered for slideshow")
            request {
                pathParameter<UUID>("profileId") { description = "Profile UUID" }
            }
            response {
                HttpStatusCode.OK to {
                    description = "Ordered photo list"
                    body<PhotoListResponse>()
                }
                HttpStatusCode.NotFound to { body<ErrorResponse>() }
            }
        }) {
            val profileId = call.profileIdParam()
            val photos    = photoService.listPhotos(profileId)
            call.respond(PhotoListResponse(photos = photos, total = photos.size))
        }

        // ── POST /v1/profiles/{profileId}/photos ────────────────────────────
        post("/v1/profiles/{profileId}/photos", {
            tags("photos")
            summary("Initiate photo upload — returns signed GCS PUT URL")
            request {
                pathParameter<UUID>("profileId") { description = "Profile UUID" }
                body<UploadPhotoRequest>()
            }
            response {
                HttpStatusCode.Created to { body<UploadPhotoResponse>() }
                HttpStatusCode.BadRequest to { body<ErrorResponse>() }
            }
        }) {
            val profileId = call.profileIdParam()
            val req       = call.receive<UploadPhotoRequest>()

            val (_, signed) = photoService.initiateUpload(
                profileId   = profileId,
                filename    = req.filename,
                contentType = req.contentType,
                caption     = req.caption,
                sortOrder   = req.sortOrder,
            )

            call.respond(
                HttpStatusCode.Created,
                UploadPhotoResponse(
                    photoId         = signed.gcsObject.substringAfterLast("/"),
                    signedUploadUrl = signed.signedUrl,
                    uploadExpiresAt = signed.expiresAt.toString(),
                )
            )
        }

        // ── GET /v1/profiles/{profileId}/photos/{photoId} ───────────────────
        get("/v1/profiles/{profileId}/photos/{photoId}", {
            tags("photos")
            summary("Get a single photo with signed view URL")
            request {
                pathParameter<UUID>("profileId")
                pathParameter<UUID>("photoId")
            }
            response {
                HttpStatusCode.OK to { body<PhotoResponse>() }
                HttpStatusCode.NotFound to { body<ErrorResponse>() }
            }
        }) {
            val profileId = call.profileIdParam()
            val photoId   = call.photoIdParam()
            val photo     = photoService.getPhoto(profileId, photoId)
            call.respond(photo)
        }

        // ── DELETE /v1/profiles/{profileId}/photos/{photoId} ────────────────
        delete("/v1/profiles/{profileId}/photos/{photoId}", {
            tags("photos")
            summary("Delete a photo from GCS and DB")
            request {
                pathParameter<UUID>("profileId")
                pathParameter<UUID>("photoId")
            }
            response {
                HttpStatusCode.NoContent to { description = "Deleted" }
                HttpStatusCode.NotFound to { body<ErrorResponse>() }
            }
        }) {
            val profileId = call.profileIdParam()
            val photoId   = call.photoIdParam()
            photoService.deletePhoto(profileId, photoId)
            call.respond(HttpStatusCode.NoContent)
        }

        // ── PUT /v1/profiles/{profileId}/photos/order ───────────────────────
        put("/v1/profiles/{profileId}/photos/order", {
            tags("photos")
            summary("Reorder photos for the slideshow")
            request {
                pathParameter<UUID>("profileId")
                body<ReorderPhotosRequest>()
            }
            response {
                HttpStatusCode.OK to { body<PhotoListResponse>() }
                HttpStatusCode.BadRequest to { body<ErrorResponse>() }
            }
        }) {
            val profileId = call.profileIdParam()
            val req       = call.receive<ReorderPhotosRequest>()
            val uuids     = req.orderedPhotoIds.map { UUID.fromString(it) }
            val photos    = photoService.reorderPhotos(profileId, uuids)
            call.respond(PhotoListResponse(photos = photos, total = photos.size))
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
private fun ApplicationCall.profileIdParam(): UUID =
    parameters["profileId"]?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        ?: throw IllegalArgumentException("profileId must be a valid UUID")

private fun ApplicationCall.photoIdParam(): UUID =
    parameters["photoId"]?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        ?: throw IllegalArgumentException("photoId must be a valid UUID")
