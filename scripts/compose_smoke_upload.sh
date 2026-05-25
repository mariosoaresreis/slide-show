#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  docker compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose up --build -d

# wait for bff health endpoint
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:8080/health/live" >/dev/null; then
    break
  fi
  sleep 1
done

# wait for frontend
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:4200" >/dev/null; then
    break
  fi
  sleep 1
done

PROFILE_ID="00000000-0000-0000-0000-000000000001"

CREATE_RESP=$(curl -fsS -X POST "http://localhost:4200/api/v1/profiles/${PROFILE_ID}/photos" \
  -H 'Content-Type: application/json' \
  -d '{"filename":"ci-smoke.jpg","contentType":"image/jpeg","caption":"ci"}')

SIGNED_URL=$(RESP_JSON="$CREATE_RESP" python3 -c 'import json,os; print(json.loads(os.environ["RESP_JSON"])["signedUploadUrl"])')
PHOTO_ID=$(RESP_JSON="$CREATE_RESP" python3 -c 'import json,os; print(json.loads(os.environ["RESP_JSON"])["photoId"])')

# Browser-like preflight and upload to signed URL
curl -fsS -X OPTIONS "$SIGNED_URL" \
  -H 'Origin: http://localhost:4200' \
  -H 'Access-Control-Request-Method: PUT' >/dev/null

curl -fsS -X PUT "$SIGNED_URL" \
  -H 'Origin: http://localhost:4200' \
  -H 'Content-Type: image/jpeg' \
  --data-binary 'ci-image-bytes' >/dev/null

LIST_RESP=$(curl -fsS "http://localhost:4200/api/v1/profiles/${PROFILE_ID}/photos")

PHOTO_STATUS=$(RESP_JSON="$LIST_RESP" PHOTO_ID="$PHOTO_ID" python3 -c 'import json,os; photos=json.loads(os.environ["RESP_JSON"])["photos"]; pid=os.environ["PHOTO_ID"]; matches=[p for p in photos if p["id"]==pid]; print(matches[0]["status"] if matches else "")')

if [[ "$PHOTO_STATUS" != "ACTIVE" ]]; then
  echo "Smoke check failed: uploaded photo status is '$PHOTO_STATUS'"
  exit 1
fi

echo "Compose smoke passed: UI, BFF, and signed upload flow are healthy."

