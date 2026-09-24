$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = '5.9.0'
$deps = Join-Path $projectRoot 'build/deps'
$compilerDir = Join-Path $deps "roslyn-$version"
$compiler = Join-Path $compilerDir 'csc.exe'
# A pinned Roslyn with /deterministic lets anyone rebuild worker.exe byte for byte.
if (-not (Test-Path -LiteralPath $compiler)) {
    [IO.Directory]::CreateDirectory($deps) | Out-Null
    $package = Join-Path $deps "microsoft.net.compilers.toolset.$version.nupkg"
    if (-not (Test-Path -LiteralPath $package)) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -UseBasicParsing -Uri "https://api.nuget.org/v3-flatcontainer/microsoft.net.compilers.toolset/$version/microsoft.net.compilers.toolset.$version.nupkg" -OutFile $package
    }
    $expected = 'B0227910320C5AF14D80EC32B5E1A759C1E3CC2EC12E7D9CC8862CF826BD9551'
    if ((Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash -ne $expected) { throw 'Roslyn compiler package hash mismatch.' }
    $staging = "$compilerDir.tmp"
    if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($package)
    try {
        foreach ($entry in $zip.Entries) {
            if (-not $entry.FullName.StartsWith('tasks/net472/') -or -not $entry.Name) { continue }
            $destination = Join-Path $staging $entry.FullName.Substring('tasks/net472/'.Length)
            [IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
        }
    } finally { $zip.Dispose() }
    Move-Item -LiteralPath $staging -Destination $compilerDir
}
$compiler
