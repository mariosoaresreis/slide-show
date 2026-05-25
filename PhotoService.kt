package com.bumble.bff.service

import com.bumble.bff.config.StorageConfig
import com.bumble.bff.model.*
import com.bumble.bff.repository.PhotoRepository
import java.util.UUID

class PhotoService(
    private val photoRepo:      PhotoRepository,
    private val storageService: GcsStorageService,
    private val storageConfig:  StorageConfig,
) {
    private val allowedTypes = setOf("image/jpeg", "image/png", "image/webp")

    /**
     * Creates a DB record in PENDING_UPLOAD state and returns a signed PUT URL.
     * Client uploads directly to GCS — BFF never touches the bytes.
     */
    suspend fun initiateUpload(
        profileId:   UUID,
        filename:    String,
        contentType: String,
        caption:     String?,
        sortOrder:   Int?,
    ): Pair<Photo, SignedUpload> {
        require(contentType in allowedTypes) {
            "Unsupported content type: $contentType. Allowed: $allowedTypes"
        }

        val nextOrder = sortOrder ?: (photoRepo.findByProfileId(profileId).size)
        val photoId   = UUID.randomUUID()

        val signed = storageService.createSignedUploadUrl(profileId, photoId, contentType)
        val photo  = photoRepo.insert(
            profileId   = profileId,
            gcsObject   = signed.gcsObject,
            contentType = contentType,
            caption     = caption,
            sortOrder   = nextOrder,
        )
        return Pair(photo, signed)
    }

    /** Returns all active photos for a profile, each with a fresh signed view URL. */
    suspend fun listPhotos(profileId: UUID): List<PhotoResponse> =
        photoRepo.findByProfileId(profileId).map { it.toResponse() }

    /** Returns a single photo with a signed view URL. */
    suspend fun getPhoto(profileId: UUID, photoId: UUID): PhotoResponse {
        val photo = photoRepo.findById(photoId)
            ?: throw NoSuchElementException("Photo $photoId not found")
        require(photo.profileId == profileId) { "Photo does not belong to profile" }
        return photo.toResponse()
    }

    /** Reorder photos — validates all IDs belong to the profile. */
    suspend fun reorderPhotos(profileId: UUID, orderedIds: List<UUID>): List<PhotoResponse> {
        val existing = photoRepo.findByProfileId(profileId).map { it.id }.toSet()
        val unknown  = orderedIds.filter { it !in existing }
        require(unknown.isEmpty()) { "Unknown photo IDs: $unknown" }
        photoRepo.reorder(profileId, orderedIds)
        return listPhotos(profileId)
    }

    /** Soft-deletes DB record and hard-deletes GCS object. */
    suspend fun deletePhoto(profileId: UUID, photoId: UUID) {
        val photo = photoRepo.findById(photoId)
            ?: throw NoSuchElementException("Photo $photoId not found")
        require(photo.profileId == profileId) { "Photo does not belong to profile" }
        photoRepo.softDelete(photoId)
        storageService.deleteObject(photo.gcsObject)
    }

    /** Maps a domain Photo to the API response DTO with a fresh signed URL. */
    private fun Photo.toResponse(): PhotoResponse {
        val signed = if (status == PhotoStatus.ACTIVE || status == PhotoStatus.PROCESSING) {
            storageService.createSignedViewUrl(gcsObject)
        } else null

        return PhotoResponse(
            id             = id.toString(),
            profileId      = profileId.toString(),
            signedViewUrl  = signed?.signedUrl,
            urlExpiresAt   = signed?.expiresAt?.toString(),
            status         = status.name,
            sortOrder      = sortOrder,
            caption        = caption,
            width          = width,
            height         = height,
            sizeBytes      = sizeBytes,
            createdAt      = createdAt.toString(),
        )
    }
}
