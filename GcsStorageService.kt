package com.bumble.bff.service

import com.bumble.bff.config.StorageConfig
import com.google.cloud.storage.BlobId
import com.google.cloud.storage.BlobInfo
import com.google.cloud.storage.HttpMethod
import com.google.cloud.storage.StorageOptions
import java.util.UUID
import java.util.concurrent.TimeUnit

data class SignedUpload(
    val signedUrl:   String,
    val gcsObject:   String,
    val expiresAt:   java.time.Instant,
)

data class SignedView(
    val signedUrl: String,
    val expiresAt: java.time.Instant,
)

class GcsStorageService(private val config: StorageConfig) {

    private val storage = StorageOptions.getDefaultInstance().service

    /**
     * Creates a v4 signed PUT URL that the client uses to upload directly to GCS.
     * The BFF never handles the raw bytes — keeps memory usage flat.
     */
    fun createSignedUploadUrl(
        profileId:   UUID,
        photoId:     UUID,
        contentType: String,
    ): SignedUpload {
        val objectName = "profiles/$profileId/photos/$photoId"
        val blobInfo = BlobInfo.newBuilder(BlobId.of(config.bucket, objectName))
            .setContentType(contentType)
            .build()

        val expiresAt = java.time.Instant.now()
            .plusSeconds(config.uploadUrlTtlMin * 60)

        val signedUrl = storage.signUrl(
            blobInfo,
            config.uploadUrlTtlMin,
            TimeUnit.MINUTES,
            com.google.cloud.storage.Storage.SignUrlOption.withV4Signature(),
            com.google.cloud.storage.Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
            com.google.cloud.storage.Storage.SignUrlOption.withContentType(),
        )

        return SignedUpload(
            signedUrl  = signedUrl.toString(),
            gcsObject  = objectName,
            expiresAt  = expiresAt,
        )
    }

    /**
     * Creates a short-lived v4 signed GET URL for the client to view a photo.
     * Called on every GET /photos response — TTL is 15 min by default.
     */
    fun createSignedViewUrl(gcsObject: String): SignedView {
        val blobInfo = BlobInfo.newBuilder(BlobId.of(config.bucket, gcsObject)).build()
        val expiresAt = java.time.Instant.now()
            .plusSeconds(config.signedUrlTtlMin * 60)

        val signedUrl = storage.signUrl(
            blobInfo,
            config.signedUrlTtlMin,
            TimeUnit.MINUTES,
            com.google.cloud.storage.Storage.SignUrlOption.withV4Signature(),
        )

        return SignedView(signedUrl = signedUrl.toString(), expiresAt = expiresAt)
    }

    /** Hard-delete the GCS object (called on photo DELETE) */
    fun deleteObject(gcsObject: String) {
        storage.delete(BlobId.of(config.bucket, gcsObject))
    }
}
