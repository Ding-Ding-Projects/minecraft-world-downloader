[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$Tag,
    [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$Version,
    [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$CommitSha,
    [string]$CatalogPath = (Join-Path $PSScriptRoot 'changelog.json'),
    [switch]$SkipRemoteHydration,
    [string]$RemoteReleasesJsonPath,
    [string]$RemoteReleasesJson
)

$ErrorActionPreference = 'Stop'

function ConvertFrom-JsonPreservingDates {
    param([Parameter(Mandatory = $true)][string]$Json)

    $parameters = @{ InputObject = $Json; Depth = 100 }
    if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) {
        $parameters.DateKind = 'String'
    }
    return ConvertFrom-Json @parameters
}

function Get-RequiredPropertyString {
    param(
        [Parameter(Mandatory = $true)][object]$InputObject,
        [Parameter(Mandatory = $true)][string]$PropertyName,
        [Parameter(Mandatory = $true)][string]$Description
    )

    $property = $InputObject.PSObject.Properties[$PropertyName]
    $rawValue = if ($null -eq $property) { $null } else { $property.Value }
    $value = if ($rawValue -is [DateTimeOffset]) {
        $rawValue.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'",
            [Globalization.CultureInfo]::InvariantCulture)
    }
    elseif ($rawValue -is [DateTime]) {
        $rawValue.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'",
            [Globalization.CultureInfo]::InvariantCulture)
    }
    elseif ($null -eq $rawValue) { '' }
    else { [string]$rawValue }
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Remote release is missing $Description ('$PropertyName')."
    }
    return $value
}

function Get-RequiredBooleanProperty {
    param(
        [Parameter(Mandatory = $true)][object]$InputObject,
        [Parameter(Mandatory = $true)][string]$PropertyName,
        [Parameter(Mandatory = $true)][string]$Description
    )

    $property = $InputObject.PSObject.Properties[$PropertyName]
    if ($null -eq $property -or $property.Value -isnot [bool]) {
        throw "Remote release is missing $Description boolean ('$PropertyName')."
    }
    return [bool]$property.Value
}

function Expand-RemoteReleasePayload {
    param([AllowNull()][object]$Node)

    if ($null -eq $Node) { return }
    if ($Node -is [System.Array]) {
        foreach ($child in $Node) { Expand-RemoteReleasePayload -Node $child }
        return
    }

    if ($Node.PSObject.Properties['tag_name']) {
        Write-Output $Node
        return
    }
    if ($Node.PSObject.Properties['releases']) {
        Expand-RemoteReleasePayload -Node $Node.releases
        return
    }

    throw 'Remote release JSON must be a GitHub Releases API array (flat or --slurp paginated).'
}

function Read-RemoteReleases {
    param([Parameter(Mandatory = $true)][string]$Repository)

    $sources = @($SkipRemoteHydration.IsPresent,
        -not [string]::IsNullOrWhiteSpace($RemoteReleasesJsonPath),
        -not [string]::IsNullOrWhiteSpace($RemoteReleasesJson)) | Where-Object { $_ }
    if ($sources.Count -gt 1) {
        throw 'Use only one of -SkipRemoteHydration, -RemoteReleasesJsonPath, or -RemoteReleasesJson.'
    }
    if ($SkipRemoteHydration) { return @() }

    if (-not [string]::IsNullOrWhiteSpace($RemoteReleasesJsonPath)) {
        $rawJson = Get-Content -LiteralPath $RemoteReleasesJsonPath -Raw -Encoding UTF8
    }
    elseif (-not [string]::IsNullOrWhiteSpace($RemoteReleasesJson)) {
        $rawJson = $RemoteReleasesJson
    }
    else {
        if ([string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
            throw 'GH_TOKEN is required to hydrate the changelog from GitHub Releases.'
        }
        $gh = Get-Command gh -CommandType Application -ErrorAction Stop
        $rawJson = (& $gh.Source api --method GET --paginate --slurp `
            -H 'Accept: application/vnd.github+json' `
            -H 'X-GitHub-Api-Version: 2022-11-28' `
            "repos/$Repository/releases?per_page=100" | Out-String)
        if ($LASTEXITCODE -ne 0) {
            throw "gh api failed while reading releases for $Repository (exit code $LASTEXITCODE)."
        }
    }

    if ([string]::IsNullOrWhiteSpace($rawJson)) {
        throw 'Remote release JSON was empty.'
    }
    $parsed = ConvertFrom-JsonPreservingDates $rawJson
    return @(Expand-RemoteReleasePayload -Node (, $parsed))
}

function Get-DerivedVersion {
    param([Parameter(Mandatory = $true)][string]$ReleaseTag)

    if ($ReleaseTag -match '^build-(\d+)$') { return "1.0.$($Matches[1])" }
    return $ReleaseTag
}

function ConvertFrom-GitHubRelease {
    param([Parameter(Mandatory = $true)][object]$Release)

    $tagName = Get-RequiredPropertyString $Release 'tag_name' 'its exact tag'
    $releaseName = Get-RequiredPropertyString $Release 'name' 'its exact name'
    $publishedAt = Get-RequiredPropertyString $Release 'published_at' 'its publication timestamp'
    $releaseUrl = Get-RequiredPropertyString $Release 'html_url' 'its exact HTML URL'
    $sourceNotes = Get-RequiredPropertyString $Release 'body' 'its exact release body'

    $parsedPublishedAt = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse($publishedAt, [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind, [ref]$parsedPublishedAt)) {
        throw "Remote release '$tagName' has an invalid published_at timestamp '$publishedAt'."
    }

    $assetsProperty = $Release.PSObject.Properties['assets']
    if ($null -eq $assetsProperty -or $null -eq $assetsProperty.Value) {
        throw "Remote release '$tagName' is missing its assets array."
    }
    $assetChanges = @()
    foreach ($asset in @($assetsProperty.Value)) {
        $assetName = Get-RequiredPropertyString $asset 'name' "an asset name for '$tagName'"
        $metadataParts = @()
        if ($null -ne $asset.PSObject.Properties['size'] -and $null -ne $asset.size) {
            $metadataParts += "$([long]$asset.size) bytes"
        }
        $contentType = if ($null -eq $asset.PSObject.Properties['content_type']) { '' } else { [string]$asset.content_type }
        if (-not [string]::IsNullOrWhiteSpace($contentType)) {
            $metadataParts += "media type $contentType"
        }
        $metadata = if ($metadataParts.Count -eq 0) { '' } else { " ($($metadataParts -join '; '))" }
        $assetChanges += [ordered]@{ text = [ordered]@{
            english = "$assetName — GitHub release asset$metadata."
            cantonese = "$assetName — GitHub 發佈檔案$metadata。"
        }}
    }
    if ($assetChanges.Count -eq 0) {
        $assetChanges = @([ordered]@{ text = [ordered]@{
            english = 'GitHub reports no downloadable assets for this release.'
            cantonese = 'GitHub 顯示呢個發佈冇可下載檔案。'
        }})
    }

    $isPrerelease = Get-RequiredBooleanProperty $Release 'prerelease' 'its prerelease status'
    $prereleaseText = $isPrerelease.ToString().ToLowerInvariant()
    return [ordered]@{
        tag = $tagName
        version = Get-DerivedVersion $tagName
        name = $releaseName
        publishedAt = $publishedAt
        url = $releaseUrl
        isPrerelease = $isPrerelease
        sourceNotes = $sourceNotes
        categories = @(
            [ordered]@{
                id = 'release-metadata'
                title = [ordered]@{ english = 'Release metadata'; cantonese = '發佈資料' }
                changes = @(
                    [ordered]@{ text = [ordered]@{
                        english = "GitHub published tag $tagName as '$releaseName' at $publishedAt."
                        cantonese = "GitHub 喺 $publishedAt 發佈 tag $tagName，名稱係「$releaseName」。"
                    }},
                    [ordered]@{ text = [ordered]@{
                        english = "GitHub prerelease status: $prereleaseText."
                        cantonese = "GitHub 預發佈狀態：$prereleaseText。"
                    }}
                )
            },
            [ordered]@{
                id = 'artifacts'
                title = [ordered]@{ english = 'Published artifacts'; cantonese = '已發佈檔案' }
                changes = @($assetChanges)
            }
        )
    }
}

function Assert-ReleaseEntry {
    param([Parameter(Mandatory = $true)][object]$Release)

    foreach ($required in @('tag', 'version', 'name', 'publishedAt', 'url', 'sourceNotes')) {
        $value = $Release.$required
        if ($null -eq $value -or [string]::IsNullOrWhiteSpace([string]$value)) {
            throw "Changelog release is missing required field '$required'."
        }
    }
    if ($null -eq $Release.isPrerelease) {
        throw "Changelog release '$($Release.tag)' is missing required field 'isPrerelease'."
    }
    $parsedPublishedAt = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse([string]$Release.publishedAt,
            [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind,
            [ref]$parsedPublishedAt)) {
        throw "Changelog release '$($Release.tag)' has an invalid publishedAt timestamp."
    }
    $uri = $null
    if (-not [Uri]::TryCreate([string]$Release.url, [UriKind]::Absolute, [ref]$uri) -or
            $uri.Scheme -ne [Uri]::UriSchemeHttps) {
        throw "Changelog release '$($Release.tag)' must have an HTTPS URL."
    }
    if (@($Release.categories).Count -eq 0) {
        throw "Changelog release '$($Release.tag)' has no categorized changes."
    }
    foreach ($category in @($Release.categories)) {
        if ([string]::IsNullOrWhiteSpace([string]$category.id) -or
                [string]::IsNullOrWhiteSpace([string]$category.title.english) -or
                [string]::IsNullOrWhiteSpace([string]$category.title.cantonese) -or
                @($category.changes).Count -eq 0) {
            throw "Changelog release '$($Release.tag)' has an incomplete bilingual category."
        }
        foreach ($change in @($category.changes)) {
            if ([string]::IsNullOrWhiteSpace([string]$change.text.english) -or
                    [string]::IsNullOrWhiteSpace([string]$change.text.cantonese)) {
                throw "Changelog release '$($Release.tag)' has an incomplete bilingual change."
            }
        }
    }
}

if (-not (Test-Path -LiteralPath $CatalogPath -PathType Leaf)) {
    throw "Changelog catalog was not found: $CatalogPath"
}
$catalog = ConvertFrom-JsonPreservingDates (Get-Content -LiteralPath $CatalogPath -Raw -Encoding UTF8)
if ([string]::IsNullOrWhiteSpace([string]$catalog.sourceRepository)) {
    throw 'Changelog catalog has no sourceRepository.'
}
if ($Tag -notmatch '^build-(\d+)$') {
    throw "Current CI tag '$Tag' must use the build-N format."
}
$expectedVersion = Get-DerivedVersion $Tag
if ($Version -ne $expectedVersion) {
    throw "Version '$Version' does not match the version derived from '$Tag' ('$expectedVersion')."
}

$releaseByTag = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal)
foreach ($existing in @($catalog.releases)) {
    Assert-ReleaseEntry $existing
    if (-not $releaseByTag.TryAdd([string]$existing.tag, $existing)) {
        throw "Duplicate changelog release tag '$($existing.tag)'."
    }
}

$remoteHydrationEnabled = -not $SkipRemoteHydration
$remoteReleases = @(Read-RemoteReleases -Repository ([string]$catalog.sourceRepository) |
    Where-Object { -not (Get-RequiredBooleanProperty $_ 'draft' 'its draft status') })
$remoteTags = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$hydratedCount = 0
foreach ($remoteRelease in $remoteReleases) {
    $remoteTag = Get-RequiredPropertyString $remoteRelease 'tag_name' 'its exact tag'
    if (-not $remoteTags.Add($remoteTag)) {
        throw "Remote release payload contains duplicate tag '$remoteTag'."
    }
    if (-not $releaseByTag.ContainsKey($remoteTag)) {
        $hydrated = ConvertFrom-GitHubRelease $remoteRelease
        $releaseByTag.Add($remoteTag, $hydrated)
        $hydratedCount++
    }
}

if (-not $releaseByTag.ContainsKey($Tag)) {
    $shortSha = $CommitSha.Substring(0, [Math]::Min(8, $CommitSha.Length))
    $publishedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    $releaseUrl = "https://github.com/$($catalog.sourceRepository)/releases/tag/$Tag"
    $sourceNotes = @'
Automated all-in-one build.
- **WorldDownloaderManager-Setup.exe** — desktop manager installer (bundles the jar, docker-compose.yml, BlueMap helper, scraper helper and full source).
- **world-downloader.jar** — the proxy/downloader jar (run with `java -jar`).
- **source.zip** — full source snapshot.
- **SHA256SUMS.txt** — SHA-256 checksums for every downloadable asset.
'@

    $releaseByTag.Add($Tag, [ordered]@{
        tag = $Tag
        version = $Version
        name = "All-in-one build $Version"
        publishedAt = $publishedAt
        url = $releaseUrl
        isPrerelease = $false
        sourceNotes = $sourceNotes
        categories = @(
            [ordered]@{
                id = 'source'
                title = [ordered]@{ english = 'Source revision'; cantonese = '原始碼版本' }
                changes = @(
                    [ordered]@{ text = [ordered]@{
                        english = "Built from commit $shortSha; the bundled source snapshot contains the exact revision."
                        cantonese = "由 commit $shortSha 建置；隨附嘅完整原始碼快照就係呢個版本，唔會玩估估下。"
                    }}
                )
            },
            [ordered]@{
                id = 'artifacts'
                title = [ordered]@{ english = 'Included artifacts'; cantonese = '隨附發佈檔案' }
                changes = @(
                    [ordered]@{ text = [ordered]@{
                        english = 'WorldDownloaderManager-Setup.exe — self-contained Windows installer with the desktop app and its helper tools.'
                        cantonese = 'WorldDownloaderManager-Setup.exe — 自包含 Windows 安裝程式，連桌面程式同輔助工具一齊帶齊。'
                    }},
                    [ordered]@{ text = [ordered]@{
                        english = 'world-downloader.jar — the proxy/downloader jar.'
                        cantonese = 'world-downloader.jar — 代理／下載器 jar。'
                    }},
                    [ordered]@{ text = [ordered]@{
                        english = 'source.zip — full source snapshot.'
                        cantonese = 'source.zip — 完整原始碼快照。'
                    }},
                    [ordered]@{ text = [ordered]@{
                        english = 'SHA256SUMS.txt — SHA-256 checksums for every downloadable asset.'
                        cantonese = 'SHA256SUMS.txt — 每個下載檔案嘅 SHA-256 校驗值，等安裝包唔可以戴假鬍鬚混入場。'
                    }}
                )
            }
        )
    })
}

foreach ($release in $releaseByTag.Values) { Assert-ReleaseEntry $release }
if ($remoteHydrationEnabled) {
    $expectedTags = [Collections.Generic.HashSet[string]]::new($remoteTags, [StringComparer]::Ordinal)
    [void]$expectedTags.Add($Tag)
    $missingTags = @($expectedTags | Where-Object { -not $releaseByTag.ContainsKey($_) } | Sort-Object)
    $unexpectedTags = @($releaseByTag.Keys | Where-Object { -not $expectedTags.Contains($_) } | Sort-Object)
    if ($missingTags.Count -gt 0 -or $unexpectedTags.Count -gt 0) {
        throw "Changelog tag set differs from remote non-draft releases plus current candidate. Missing: $($missingTags -join ', '); unexpected: $($unexpectedTags -join ', ')."
    }
}

$catalog.releases = @($releaseByTag.Values | Sort-Object `
    @{ Expression = { [DateTimeOffset]::Parse([string]$_.publishedAt, [Globalization.CultureInfo]::InvariantCulture) }; Descending = $true }, `
    @{ Expression = { [string]$_.tag }; Descending = $true })
$json = $catalog | ConvertTo-Json -Depth 100
$temporaryPath = "$CatalogPath.$([Guid]::NewGuid().ToString('N')).tmp"
try {
    [IO.File]::WriteAllText($temporaryPath, $json + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryPath -Destination $CatalogPath -Force
}
finally {
    if (Test-Path -LiteralPath $temporaryPath) {
        Remove-Item -LiteralPath $temporaryPath -Force
    }
}

Write-Host "Embedded changelog is ready for $Tag ($Version): hydrated $hydratedCount missing remote release(s); $($catalog.releases.Count) total entries."
