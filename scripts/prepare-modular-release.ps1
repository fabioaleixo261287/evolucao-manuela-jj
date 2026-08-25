param(
    [string]$Version = (Get-Date -Format "yyyyMMdd-HHmmss")
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ReleaseRoot = Join-Path $Root "release-candidates"
$Target = Join-Path $ReleaseRoot "modular-$Version"

Push-Location $Root
try {
    npm test
    if ($LASTEXITCODE -ne 0) { throw "Testes falharam." }
    npm run build:modular
    if ($LASTEXITCODE -ne 0) { throw "Build falhou." }

    New-Item -ItemType Directory -Force -Path $Target | Out-Null
    Copy-Item -Recurse -Force -Path (Join-Path $Root "dist-modular\*") -Destination $Target
    Copy-Item -Force -Path (Join-Path $Root "index.html") -Destination (Join-Path $Target "index-producao-anterior.html")

    $manifest = [ordered]@{
        version = $Version
        createdAt = (Get-Date).ToString("o")
        sourceCommit = (git rev-parse HEAD)
        tests = "approved"
        build = "approved"
        publishStatus = "not-published"
        rollbackFile = "index-producao-anterior.html"
    }
    $manifest | ConvertTo-Json | Set-Content -Encoding UTF8 -Path (Join-Path $Target "release-manifest.json")
    Write-Output "Candidato preparado em: $Target"
} finally {
    Pop-Location
}
