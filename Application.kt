package com.bumble.bff

import com.bumble.bff.config.AppConfig
import com.bumble.bff.plugins.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*

fun main() {
    embeddedServer(
        Netty,
        port = System.getenv("PORT")?.toIntOrNull() ?: 8080,
        host = "0.0.0.0",
        module = Application::module
    ).start(wait = true)
}

fun Application.module() {
    val config = AppConfig.load()

    configureSerialization()
    configureDatabase(config.database)
    configureSecurity(config.jwt)
    configureCors()
    configureRateLimit()
    configureRequestValidation()
    configureMetrics(config.gcp)
    configureStatusPages()
    configureCallLogging()
    configureSwagger()
    configureRouting(config)
}
