#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <base-url> [origin]" >&2
  exit 1
fi

BASE_URL="${1%/}"
ORIGIN="${2:-http://localhost:4200}"
PROFILE_ID="00000000-0000-0000-0000-000000000001"

healthy="false"
for _ in $(seq 1 60); do
  if curl -fsS "${BASE_URL}/health/live" >/dev/null; then
    healthy="true"
    break
  fi
  sleep 2
done

if [[ "$healthy" != "true" ]]; then
  echo "Smoke check failed: ${BASE_URL}/health/live never became healthy" >&2
  exit 1
fi

CREATE_RESP=$(curl -fsS -X POST "${BASE_URL}/v1/profiles/${PROFILE_ID}/photos" \
  -H 'Content-Type: application/json' \
  -d '{"filename":"cloud-smoke.jpg","contentType":"image/jpeg","caption":"cloud-smoke"}')

SIGNED_URL=$(RESP_JSON="$CREATE_RESP" python3 -c 'import json,os; print(json.loads(os.environ["RESP_JSON"])["signedUploadUrl"])')
PHOTO_ID=$(RESP_JSON="$CREATE_RESP" python3 -c 'import json,os; print(json.loads(os.environ["RESP_JSON"])["photoId"])')

curl -fsS -X OPTIONS "$SIGNED_URL" \
  -H "Origin: ${ORIGIN}" \
  -H 'Access-Control-Request-Method: PUT' \
  -H 'Access-Control-Request-Headers: content-type' >/dev/null

curl -fsS -X PUT "$SIGNED_URL" \
  -H "Origin: ${ORIGIN}" \
  -H 'Content-Type: image/jpeg' \
  --data-binary 'cloud-smoke-bytes' >/dev/null

LIST_RESP=$(curl -fsS "${BASE_URL}/v1/profiles/${PROFILE_ID}/photos")
PHOTO_STATUS=$(RESP_JSON="$LIST_RESP" PHOTO_ID="$PHOTO_ID" python3 -c 'import json,os; photos=json.loads(os.environ["RESP_JSON"])["photos"]; pid=os.environ["PHOTO_ID"]; matches=[p for p in photos if p["id"]==pid]; print(matches[0]["status"] if matches else "")')

if [[ "$PHOTO_STATUS" != "ACTIVE" ]]; then
  echo "Smoke check failed: uploaded photo status is '$PHOTO_STATUS'" >&2
  exit 1
fi

echo "Cloud smoke passed for ${BASE_URL}."


