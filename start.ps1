$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js 18 or later is required. Install it from https://nodejs.org/ and try again.' -ForegroundColor Red
  exit 1
}

node .\scripts\serve.mjs --open
