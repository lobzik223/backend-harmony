# Run Harmony Backend in Docker (local)
# Creates .env from env.docker.example if missing, then starts containers.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path .env)) {
    Write-Host "Creating .env from env.docker.example..."
    Copy-Item env.docker.example .env
}

Write-Host "Starting containers (backend)..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Container harmony_backend should appear in Docker Desktop."
Write-Host "API: http://localhost:3000/api  |  Health: http://localhost:3000/api/health"
Write-Host "Logs: docker compose logs -f backend"
