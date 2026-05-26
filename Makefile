.PHONY: up down test smoke clean logs help

# ── Defaults ──────────────────────────────────────────────────────────────────
COMPOSE := docker compose

## up: Build and start the full stack (UI + BFF). Open http://localhost:4200
up:
	$(COMPOSE) up --build -d
	@echo ""
	@echo "  ✓ Stack is up"
	@echo "  UI  →  http://localhost:4200"
	@echo "  BFF →  http://localhost:8080"
	@echo ""
	@echo "  Run 'make logs' to tail logs, 'make down' to stop."

## down: Stop and remove containers + volumes
down:
	$(COMPOSE) down -v

## test: Run backend unit + integration tests
test:
	./gradlew --no-daemon test

## smoke: Run the local end-to-end upload smoke test (starts its own stack)
smoke:
	./scripts/compose_smoke_upload.sh

## logs: Tail logs from all services
logs:
	$(COMPOSE) logs -f

## clean: Remove containers, volumes, and build artefacts
clean:
	$(COMPOSE) down -v --remove-orphans
	./gradlew --no-daemon clean
	rm -rf UI/dist UI/.angular

## help: List available targets
help:
	@grep -E '^## ' Makefile | sed 's/## //' | column -t -s ':'

