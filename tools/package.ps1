$ErrorActionPreference = 'Stop'
$taskWorkspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskModule = Join-Path $taskWorkspace 'selos-de-drakkenheim'
$taskManifest = Get-Content -LiteralPath (Join-Path $taskModule 'module.json') -Raw | ConvertFrom-Json
$taskOutput = Join-Path $taskWorkspace ('selos-de-drakkenheim-v' + $taskManifest.version + '.zip')
Compress-Archive -LiteralPath $taskModule -DestinationPath $taskOutput -Force
Get-Item -LiteralPath $taskOutput | Select-Object FullName,Length
