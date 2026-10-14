$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (Test-Path -LiteralPath '.tools\cargo\bin\cargo.exe') {
  $env:CARGO_HOME = Join-Path $PWD '.tools\cargo'
  $env:RUSTUP_HOME = Join-Path $PWD '.tools\rustup'
  $env:PATH = "$env:CARGO_HOME\bin;$env:PATH"
}
pnpm install --frozen-lockfile
if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm test
if ($LASTEXITCODE) { exit $LASTEXITCODE }
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked
if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm desktop:build
