package com.bumble.bff

import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.options
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class UploadFlowIntegrationTest {
    private val profileId = "00000000-0000-0000-0000-000000000001"

    @Test
    fun `signed upload flow supports CORS preflight and put`() = testApplication {
        application { module() }

        val createResponse = client.post("/v1/profiles/$profileId/photos") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {"filename":"integration.jpg","contentType":"image/jpeg","caption":"integration"}
                """.trimIndent()
            )
        }

        assertEquals(HttpStatusCode.Created, createResponse.status)
        val uploadResponse = Json.decodeFromString<UploadPhotoResponse>(createResponse.bodyAsText())
        val uploadPath = uploadResponse.signedUploadUrl.substringAfter("http://localhost:8080")

        val preflight = client.options(uploadPath) {
            headers.append(HttpHeaders.Origin, "http://localhost:4200")
            headers.append(HttpHeaders.AccessControlRequestMethod, HttpMethod.Put.value)
            headers.append(HttpHeaders.AccessControlRequestHeaders, "content-type")
        }

        assertEquals(HttpStatusCode.OK, preflight.status)
        assertEquals("*", preflight.headers[HttpHeaders.AccessControlAllowOrigin])
        assertTrue(preflight.headers[HttpHeaders.AccessControlAllowMethods].orEmpty().contains("PUT"))

        val uploadPut = client.put(uploadPath) {
            headers.append(HttpHeaders.Origin, "http://localhost:4200")
            contentType(ContentType.Image.JPEG)
            setBody("fake-image-bytes")
        }

        assertEquals(HttpStatusCode.OK, uploadPut.status)
        assertEquals("*", uploadPut.headers[HttpHeaders.AccessControlAllowOrigin])

        val listResponse = client.get("/v1/profiles/$profileId/photos")
        assertEquals(HttpStatusCode.OK, listResponse.status)

        val photos = Json.decodeFromString<PhotoListResponse>(listResponse.bodyAsText())
        val uploaded = photos.photos.firstOrNull { it.id == uploadResponse.photoId }
        assertNotNull(uploaded)
        assertEquals("ACTIVE", uploaded.status)
        assertNotNull(uploaded.signedViewUrl)
    }

    @Test
    fun `delete removes uploaded photo`() = testApplication {
        application { module() }

        val createResponse = client.post("/v1/profiles/$profileId/photos") {
            contentType(ContentType.Application.Json)
            setBody("""{"filename":"to-delete.jpg","contentType":"image/jpeg"}""")
        }
        val uploadResponse = Json.decodeFromString<UploadPhotoResponse>(createResponse.bodyAsText())
        val uploadPath = uploadResponse.signedUploadUrl.substringAfter("http://localhost:8080")

        client.put(uploadPath) {
            contentType(ContentType.Image.JPEG)
            setBody("fake-bytes")
        }

        val deleteResponse = client.delete("/v1/profiles/$profileId/photos/${uploadResponse.photoId}")
        assertEquals(HttpStatusCode.NoContent, deleteResponse.status)

        val listResponse = client.get("/v1/profiles/$profileId/photos")
        val photos = Json.decodeFromString<PhotoListResponse>(listResponse.bodyAsText())
        assertTrue(photos.photos.none { it.id == uploadResponse.photoId })
    }
}


