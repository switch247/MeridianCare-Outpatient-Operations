#!/usr/bin/env sh
set -eu

COMPOSE="docker compose"

# Bring up services
$COMPOSE up -d --build

echo "Waiting up to 60s for Postgres readiness..."
db_ready=0
for i in $(seq 1 60); do
	if $COMPOSE exec -T db sh -lc 'pg_isready -U postgres -d meridiancare-clinic' >/dev/null 2>&1; then
		db_ready=1
		break
	fi
	sleep 1
done

if [ "$db_ready" -ne 1 ]; then
	echo "Postgres did not become ready within 60s. Showing DB logs for debugging:"
	$COMPOSE logs --no-color db || true
	exit 1
fi

# Backend may have started before DB was ready; restart once to ensure clean startup.
$COMPOSE restart backend >/dev/null

echo "Waiting up to 60s for backend health endpoint..."
ready=0
for i in $(seq 1 60); do
	if curl -fsS http://localhost:13000/health >/dev/null 2>&1; then
		ready=1
		break
	fi
	sleep 1
done

if [ "$ready" -ne 1 ]; then
	echo "Backend did not become healthy within 60s. Showing backend logs for debugging:"
	$COMPOSE logs --no-color backend || true
	exit 1
fi

echo "Running backend unit tests..."
$COMPOSE exec -T backend sh -lc 'npm test --silent' || {
    echo "Backend tests failed" >&2
    exit 1
}

echo "Running backend API acceptance tests..."
$COMPOSE exec -T backend sh -lc 'API_BASE_URL=http://localhost:3000 npm run test:api --silent' || {
	echo "Backend API acceptance tests failed" >&2
	exit 1
}

echo "Validating backend OpenAPI contract..."
$COMPOSE exec -T backend sh -lc 'npm run test:openapi --silent' || {
	echo "Backend OpenAPI validation failed" >&2
	exit 1
}

echo "Running frontend tests..."
$COMPOSE exec -T frontend sh -lc '
	if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
		echo "Installing Chromium in frontend container for headless tests..."
		apk add --no-cache chromium >/dev/null
	fi
	CHROME_BIN_PATH="$(command -v chromium-browser 2>/dev/null || command -v chromium 2>/dev/null || true)"
	if [ -z "$CHROME_BIN_PATH" ]; then
		echo "Could not locate Chromium binary after install." >&2
		exit 1
	fi
	export CHROME_BIN="$CHROME_BIN_PATH"
	npm test --silent
' || {
	echo "Frontend tests failed" >&2
	exit 1
}

echo "Running frontend UI E2E scenario tests (Playwright)..."
$COMPOSE exec -T frontend sh -lc '
	CHROME_BIN_PATH="$(command -v chromium-browser 2>/dev/null || command -v chromium 2>/dev/null || true)"
	if [ -z "$CHROME_BIN_PATH" ]; then
		echo "Chromium binary not found for Playwright." >&2
		exit 1
	fi
	API_BASE_URL=http://backend:3000 PLAYWRIGHT_CHROMIUM_PATH="$CHROME_BIN_PATH" npm run test:e2e --silent
' || {
	echo "Frontend E2E scenario tests failed" >&2
	exit 1
}

echo "All tests passed."
