# Build server.zip for cPanel upload (includes passenger_wsgi.py).
$ErrorActionPreference = "Stop"
$serverRoot = Split-Path -Parent $PSScriptRoot
$zipPath = Join-Path $serverRoot "server.zip"

$include = @(
    "core",
    "deploy",
    "fooddelivery",
    "manage.py",
    "passenger_wsgi.py",
    "repair_schema.py",
    "requirements.txt",
    "static"
)

$temp = Join-Path $env:TEMP ("fd-server-" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Path $temp | Out-Null
try {
    foreach ($name in $include) {
        $src = Join-Path $serverRoot $name
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination (Join-Path $temp $name) -Recurse -Force
        }
    }
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $temp "*") -DestinationPath $zipPath -Force
    Write-Host "Created $zipPath"
} finally {
    Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
