$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (Test-Path -LiteralPath '.tools\cargo\bin\cargo.exe') {
  $env:CARGO_HOME = Join-Path $PWD '.tools\cargo'
  $env:RUSTUP_HOME = Join-Path $PWD '.tools\rustup'
  $env:PATH = "$env:CARGO_HOME\bin;$env:PATH"
}
pnpm desktop
