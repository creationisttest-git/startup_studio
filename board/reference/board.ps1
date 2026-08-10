# Loads .board.env into the process environment and forwards everything to board-cli.js.
#
# The CLI reads credentials from the environment and embeds none, which is why it is safe to
# commit. This wrapper exists so the credentials never have to be typed on a command line,
# where they would land in shell history.
#
#   .\board.ps1 list
#   .\board.ps1 add "Title text" todo
#   .\board.ps1 whoami

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot '.board.env'

if (-not (Test-Path $envFile)) {
  Write-Error "No .board.env in $PSScriptRoot. Copy .board.env.example to .board.env and fill it in."
  exit 1
}

foreach ($line in Get-Content $envFile) {
  $trimmed = $line.Trim()
  if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
  $i = $trimmed.IndexOf('=')
  if ($i -lt 1) { continue }
  $name  = $trimmed.Substring(0, $i).Trim()
  $value = $trimmed.Substring($i + 1).Trim()
  Set-Item -Path "env:$name" -Value $value
}

# The refusal in board-cli.js is the real gate. This is only a clearer message, earlier.
foreach ($banned in @('SUPABASE_SERVICE_KEY','SUPABASE_SERVICE_ROLE_KEY')) {
  if (Test-Path "env:$banned") {
    Write-Error "$banned is set. It bypasses row-level security and must never reach a project. Remove it."
    exit 1
  }
}

& node (Join-Path $PSScriptRoot 'board-cli.js') @args
exit $LASTEXITCODE
