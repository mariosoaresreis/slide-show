package com.bumble.bff

import io.ktor.http.HttpStatusCode
import io.ktor.http.HttpMethod
import io.ktor.http.HttpHeaders
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.cors.routing.CORS
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.routing
import kotlinx.serialization.Serializable
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Serializable
data class HealthResponse(
    val status: String,
    val timestamp: String,
    val checks: Map<String, String> = emptyMap(),
)

@Serializable
data class ProfileResponse(
    val id: String,
    val displayName: String,
    val primaryPhotoUrl: String? = null,
    val photoCount: Int,
    val createdAt: String,
)

@Serializable
data class PhotoResponse(
    val id: String,
    val profileId: String,
    val signedViewUrl: String? = null,
    val urlExpiresAt: String? = null,
    val status: String,
    val sortOrder: Int,
    val caption: String? = null,
    val width: Int? = null,
    val height: Int? = null,
    val sizeBytes: Long? = null,
    val createdAt: String,
)

@Serializable
data class PhotoListResponse(
    val photos: List<PhotoResponse>,
    val total: Int,
)

@Serializable
data class UploadPhotoRequest(
    val filename: String,
    val contentType: String,
    val caption: String? = null,
    val sortOrder: Int? = null,
)

@Serializable
data class UploadPhotoResponse(
    val photoId: String,
    val signedUploadUrl: String,
    val uploadExpiresAt: String,
)

@Serializable
data class ReorderPhotosRequest(
    val orderedPhotoIds: List<String>,
)

data class PhotoRecord(
    val id: String,
    val profileId: String,
    var status: String,
    var sortOrder: Int,
    var caption: String?,
    val createdAt: String,
    var signedViewUrl: String? = null,
    var urlExpiresAt: String? = null,
)

fun main() {
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080
    embeddedServer(Netty, host = "0.0.0.0", port = port, module = Application::module).start(wait = true)
}

fun Application.module() {
    install(CORS) {
        anyHost()
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Authorization)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Options)
        allowNonSimpleContentTypes = true
    }

    install(ContentNegotiation) {
        json()
    }

    val publicBaseUrl = System.getenv("PUBLIC_BASE_URL")
        ?: "http://localhost:${System.getenv("PORT") ?: "8080"}"

    val createdAt = Instant.now().toString()
    val photosByProfile = ConcurrentHashMap<String, MutableList<PhotoRecord>>()

    fun photoToResponse(photo: PhotoRecord) = PhotoResponse(
        id = photo.id,
        profileId = photo.profileId,
        signedViewUrl = photo.signedViewUrl,
        urlExpiresAt = photo.urlExpiresAt,
        status = photo.status,
        sortOrder = photo.sortOrder,
        caption = photo.caption,
        createdAt = photo.createdAt,
    )

    fun orderedPhotos(profileId: String): List<PhotoRecord> =
        photosByProfile[profileId].orEmpty().sortedBy { it.sortOrder }

    routing {
        get("/health/live") {
            call.respond(
                HealthResponse(
                    status = "UP",
                    timestamp = Instant.now().toString(),
                )
            )
        }

        get("/health/ready") {
            call.respond(
                HealthResponse(
                    status = "UP",
                    timestamp = Instant.now().toString(),
                    checks = mapOf("inMemoryStore" to "ok"),
                )
            )
        }

        get("/v1/profiles/{profileId}") {
            val profileId = call.parameters["profileId"] ?: return@get call.respond(
                HttpStatusCode.BadRequest,
                mapOf("error" to "BadRequest", "message" to "profileId is required")
            )
            val photos = orderedPhotos(profileId)
            call.respond(
                ProfileResponse(
                    id = profileId,
                    displayName = "Local Demo Profile",
                    primaryPhotoUrl = photos.firstOrNull { it.status == "ACTIVE" }?.signedViewUrl,
                    photoCount = photos.count { it.status == "ACTIVE" },
                    createdAt = createdAt,
                )
            )
        }

        get("/v1/profiles/{profileId}/photos") {
            val profileId = call.parameters["profileId"] ?: return@get call.respond(
                HttpStatusCode.BadRequest,
                mapOf("error" to "BadRequest", "message" to "profileId is required")
            )
            val photos = orderedPhotos(profileId).filter { it.status != "DELETED" }.map(::photoToResponse)
            call.respond(PhotoListResponse(photos = photos, total = photos.size))
        }

        post("/v1/profiles/{profileId}/photos") {
            val profileId = call.parameters["profileId"] ?: return@post call.respond(
                HttpStatusCode.BadRequest,
                mapOf("error" to "BadRequest", "message" to "profileId is required")
            )
            val body = call.receive<UploadPhotoRequest>()
            val photoId = UUID.randomUUID().toString()
            val now = Instant.now()
            val uploadExpiresAt = now.plusSeconds(900).toString()
            val currentPhotos = photosByProfile.computeIfAbsent(profileId) { mutableListOf() }
            val nextOrder = body.sortOrder ?: currentPhotos.size
            currentPhotos.add(
                PhotoRecord(
                    id = photoId,
                    profileId = profileId,
                    status = "PENDING_UPLOAD",
                    sortOrder = nextOrder,
                    caption = body.caption,
                    createdAt = now.toString(),
                    signedViewUrl = null,
                    urlExpiresAt = null,
                )
            )

            val uploadUrl = "$publicBaseUrl/mock-upload/$photoId"
            call.respond(
                HttpStatusCode.Created,
                UploadPhotoResponse(
                    photoId = photoId,
                    signedUploadUrl = uploadUrl,
                    uploadExpiresAt = uploadExpiresAt,
                )
            )
        }

        put("/mock-upload/{photoId}") {
            val photoId = call.parameters["photoId"] ?: return@put call.respond(HttpStatusCode.BadRequest)
            val allPhotos = photosByProfile.values.flatten()
            val record = allPhotos.firstOrNull { it.id == photoId }
                ?: return@put call.respond(HttpStatusCode.NotFound)

            record.status = "ACTIVE"
            record.urlExpiresAt = Instant.now().plusSeconds(900).toString()
            record.signedViewUrl = "https://picsum.photos/seed/${record.id}/900/1200"
            call.respond(HttpStatusCode.OK)
        }

        get("/v1/profiles/{profileId}/photos/{photoId}") {
            val profileId = call.parameters["profileId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
            val photoId = call.parameters["photoId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
            val record = orderedPhotos(profileId).firstOrNull { it.id == photoId }
                ?: return@get call.respond(HttpStatusCode.NotFound)
            call.respond(photoToResponse(record))
        }

        put("/v1/profiles/{profileId}/photos/order") {
            val profileId = call.parameters["profileId"] ?: return@put call.respond(HttpStatusCode.BadRequest)
            val body = call.receive<ReorderPhotosRequest>()
            val current = photosByProfile[profileId] ?: mutableListOf()
            val indexById = body.orderedPhotoIds.withIndex().associate { it.value to it.index }
            current.forEach { photo ->
                indexById[photo.id]?.let { newOrder -> photo.sortOrder = newOrder }
            }
            val photos = orderedPhotos(profileId).filter { it.status != "DELETED" }.map(::photoToResponse)
            call.respond(PhotoListResponse(photos = photos, total = photos.size))
        }

        delete("/v1/profiles/{profileId}/photos/{photoId}") {
            val profileId = call.parameters["profileId"] ?: return@delete call.respond(HttpStatusCode.BadRequest)
            val photoId = call.parameters["photoId"] ?: return@delete call.respond(HttpStatusCode.BadRequest)
            val current = photosByProfile[profileId] ?: return@delete call.respond(HttpStatusCode.NotFound)
            val removed = current.removeIf { it.id == photoId }
            if (!removed) {
                return@delete call.respond(HttpStatusCode.NotFound)
            }
            call.respond(HttpStatusCode.NoContent)
        }
    }
}



