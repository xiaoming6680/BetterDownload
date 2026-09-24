param(
    [Parameter(Mandatory = $true)][string]$Repository,
    [Parameter(Mandatory = $true)][string]$Author
)
$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Repository 格式应为 GitHub用户名/仓库名。' }
if ([string]::IsNullOrWhiteSpace($Author)) { throw 'Author 不能为空。' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot 'plugin/manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$manifest.author = $Author
$manifest | Add-Member -NotePropertyName author_link -NotePropertyValue "https://github.com/$($Repository.Split('/')[0])" -Force
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($manifestPath, (($manifest | ConvertTo-Json -Depth 10) + "`n"), $utf8)
$links = @{ repository = "https://github.com/$Repository"; issues = "https://github.com/$Repository/issues" }
[IO.File]::WriteAllText((Join-Path $projectRoot 'plugin/release.json'), (($links | ConvertTo-Json) + "`n"), $utf8)
$submissionDir = Join-Path $projectRoot 'build/submission'
[IO.Directory]::CreateDirectory($submissionDir) | Out-Null
$entry = [ordered]@{ name = $manifest.name; repo = $Repository; branch = 'main'; subpath = '/plugin'; author = $Author }
[IO.File]::WriteAllText((Join-Path $submissionDir "$($manifest.slug).json"), (($entry | ConvertTo-Json) + "`n"), $utf8)
Write-Output '已填写作者、源码和反馈链接，并生成 build/submission 中的商店元数据。'
