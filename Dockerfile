# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM gradle:8.7-jdk17-alpine AS build

WORKDIR /app
COPY --chown=gradle:gradle . .

RUN gradle buildFatJar --no-daemon -x test

# ── Stage 2: Runtime (distroless) ────────────────────────────────────────────
FROM gcr.io/distroless/java17-debian12:nonroot

WORKDIR /app

# Copy the fat JAR from the build stage
COPY --from=build /app/build/libs/bumble-bff.jar app.jar

# Cloud Run listens on PORT env var (default 8080)
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-jar", "app.jar"]
