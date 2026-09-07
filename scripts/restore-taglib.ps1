$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$deps = Join-Path $projectRoot 'build/deps'
[IO.Directory]::CreateDirectory($deps) | Out-Null
$package = Join-Path $deps 'taglibsharp.2.3.0.nupkg'
if (-not (Test-Path -LiteralPath $package)) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri 'https://api.nuget.org/v3-flatcontainer/taglibsharp/2.3.0/taglibsharp.2.3.0.nupkg' -OutFile $package
}
$expected = '3C3F5B55988F69E0BC84DC760FEB8351FEF4D5C09A322D88462E683D334DFBFC'
if ((Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash -ne $expected) { throw 'TagLibSharp package hash mismatch.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($package)
try {
    [IO.Compression.ZipFileExtensions]::ExtractToFile($zip.GetEntry('lib/net462/TagLibSharp.dll'), (Join-Path $projectRoot 'plugin/TagLibSharp.dll'), $true)
} finally { $zip.Dispose() }
