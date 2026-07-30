using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.Json;

namespace WorldDownloaderManager;

public enum ChangelogLanguage
{
    English,
    Cantonese,
    Bilingual,
}

public enum ChangelogDatePreset
{
    AllTime,
    Last7Days,
    Last30Days,
    Last90Days,
    Last365Days,
    ThisMonth,
    ThisYear,
}

/// <summary>Factual release copy in both supported languages.</summary>
public sealed class LocalizedChangelogText
{
    public string English { get; init; } = "";
    public string Cantonese { get; init; } = "";

    public string Resolve(ChangelogLanguage language, string bilingualSeparator = "\n") => language switch
    {
        ChangelogLanguage.Cantonese => Cantonese,
        ChangelogLanguage.Bilingual when string.Equals(English, Cantonese, StringComparison.Ordinal) => English,
        ChangelogLanguage.Bilingual => English + bilingualSeparator + Cantonese,
        _ => English,
    };

    public string ResolveStyled(ChangelogLanguage language, int englishFunnyLevel,
        int cantoneseFunnyLevel, string bilingualSeparator = "\n") => language switch
    {
        ChangelogLanguage.Cantonese => StyleCantonese(Cantonese, cantoneseFunnyLevel),
        ChangelogLanguage.Bilingual when string.Equals(English, Cantonese, StringComparison.Ordinal) =>
            StyleEnglish(English, englishFunnyLevel),
        ChangelogLanguage.Bilingual => StyleEnglish(English, englishFunnyLevel) + bilingualSeparator +
                                       StyleCantonese(Cantonese, cantoneseFunnyLevel),
        _ => StyleEnglish(English, englishFunnyLevel),
    };

    private static string StyleEnglish(string fact, int level) => Math.Clamp(level, 1, 5) switch
    {
        2 => "Update: " + fact,
        3 => "Ship log: " + fact,
        4 => "Release gremlin report: " + fact,
        5 => "Fresh from the chunk oven: " + fact + " 🧱",
        _ => fact,
    };

    private static string StyleCantonese(string fact, int level) => Math.Clamp(level, 1, 5) switch
    {
        2 => "更新：" + fact,
        3 => "出貨筆記：" + fact,
        4 => "版本精靈報告：" + fact,
        5 => "啱啱由方塊焗爐出爐：" + fact + " 🧱",
        _ => fact,
    };
}

public sealed class ChangelogChange
{
    public LocalizedChangelogText Text { get; init; } = new();
}

public sealed class ChangelogCategory
{
    public string Id { get; init; } = "";
    public LocalizedChangelogText Title { get; init; } = new();
    public ChangelogChange[] Changes { get; init; } = Array.Empty<ChangelogChange>();
}

public sealed class ChangelogRelease
{
    public string Tag { get; init; } = "";
    public string Version { get; init; } = "";
    public string Name { get; init; } = "";
    public DateTimeOffset PublishedAt { get; init; }
    public string Url { get; init; } = "";
    public bool IsPrerelease { get; init; }
    public string SourceNotes { get; init; } = "";
    public ChangelogCategory[] Categories { get; init; } = Array.Empty<ChangelogCategory>();

    /// <summary>The calendar date recorded by GitHub, interpreted in UTC.</summary>
    public DateOnly ReleaseDate => DateOnly.FromDateTime(PublishedAt.UtcDateTime);

    /// <summary>Stable, read-only label for release-list presentation.</summary>
    public string DisplayName => $"{ReleaseDate:yyyy-MM-dd} · {Name} · {Tag}";
}

public sealed class ChangelogDocument
{
    public string SourceRepository { get; init; } = "";
    public ChangelogRelease[] Releases { get; init; } = Array.Empty<ChangelogRelease>();
}

public sealed record ChangelogDateParseResult(bool IsValid, DateOnly? Value, string? Error);

public sealed record ChangelogDateRange(DateOnly? Start, DateOnly? End)
{
    public static ChangelogDateRange AllTime { get; } = new(null, null);
    public bool IsValid => Start is null || End is null || Start <= End;

    public bool Contains(DateOnly date) =>
        (Start is null || date >= Start.Value) && (End is null || date <= End.Value);

    public string ToIsoDescription() => (Start, End) switch
    {
        ({ } start, { } end) => $"{start:yyyy-MM-dd} through {end:yyyy-MM-dd} (inclusive)",
        ({ } start, null) => $"{start:yyyy-MM-dd} onward (inclusive)",
        (null, { } end) => $"through {end:yyyy-MM-dd} (inclusive)",
        _ => "all release dates",
    };
}

public sealed record ChangelogFilterOptions(
    ChangelogDateRange? DateRange = null,
    string Query = "",
    bool UseRegex = false,
    string RegexFlags = "i");

public sealed record ChangelogFilterResult(
    bool IsValid,
    string? Error,
    IReadOnlyList<ChangelogRelease> Releases,
    ChangelogDateRange DateRange,
    string Query,
    bool UsesRegex,
    string RegexFlags);

/// <summary>
/// Offline changelog catalog and filtering/export logic. Release data is embedded at build time;
/// the desktop application never contacts GitHub to render the changelog.
/// </summary>
public sealed class ChangelogService
{
    private const string ExpectedRepository = "Ding-Ding-Projects/minecraft-world-downloader";
    private const string EmbeddedResourceSuffix = ".Resources.changelog.json";
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    private readonly ReadOnlyCollection<ChangelogRelease> _releases;

    internal ChangelogService(ChangelogDocument document)
    {
        Validate(document);
        _releases = Array.AsReadOnly(document.Releases
            .OrderByDescending(release => release.PublishedAt)
            .ThenByDescending(release => release.Tag, StringComparer.Ordinal)
            .ToArray());
        SourceRepository = document.SourceRepository;
    }

    public string SourceRepository { get; }
    public IReadOnlyList<ChangelogRelease> Releases => _releases;

    public static ChangelogService LoadEmbedded(Assembly? assembly = null)
    {
        assembly ??= typeof(ChangelogService).Assembly;
        var resourceName = assembly.GetManifestResourceNames().SingleOrDefault(name =>
            name.EndsWith(EmbeddedResourceSuffix, StringComparison.OrdinalIgnoreCase));
        if (resourceName is null)
            throw new InvalidDataException($"Embedded changelog resource '*{EmbeddedResourceSuffix}' was not found.");

        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidDataException($"Embedded changelog resource '{resourceName}' could not be opened.");
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        return new ChangelogService(ParseDocument(reader.ReadToEnd()));
    }

    internal static ChangelogDocument ParseDocument(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<ChangelogDocument>(json, JsonOptions)
                ?? throw new InvalidDataException("The embedded changelog document is empty.");
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException("The embedded changelog document is not valid JSON.", ex);
        }
    }

    public static ChangelogDateParseResult ParseTypedDate(string? input, CultureInfo? culture = null)
    {
        if (string.IsNullOrWhiteSpace(input))
            return new(false, null, "Enter a date.");

        var text = input.Trim();
        if (DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var isoDate))
            return new(true, isoDate, null);

        culture ??= CultureInfo.CurrentCulture;
        var localPatterns = culture.DateTimeFormat.GetAllDateTimePatterns('d');
        if (DateOnly.TryParseExact(text, localPatterns, culture, DateTimeStyles.AllowWhiteSpaces,
                out var localDate))
            return new(true, localDate, null);

        return new(false, null,
            $"'{input}' is not a valid date. Use {culture.DateTimeFormat.ShortDatePattern} or yyyy-MM-dd.");
    }

    public static ChangelogDateParseResult ParseOptionalTypedDate(string? input, CultureInfo? culture = null) =>
        string.IsNullOrWhiteSpace(input)
            ? new ChangelogDateParseResult(true, null, null)
            : ParseTypedDate(input, culture);

    public static ChangelogDateRange RangeForPreset(ChangelogDatePreset preset, DateOnly today) => preset switch
    {
        ChangelogDatePreset.AllTime => ChangelogDateRange.AllTime,
        ChangelogDatePreset.Last7Days => new(today.AddDays(-6), today),
        ChangelogDatePreset.Last30Days => new(today.AddDays(-29), today),
        ChangelogDatePreset.Last90Days => new(today.AddDays(-89), today),
        ChangelogDatePreset.Last365Days => new(today.AddDays(-364), today),
        ChangelogDatePreset.ThisMonth => new(new DateOnly(today.Year, today.Month, 1), today),
        ChangelogDatePreset.ThisYear => new(new DateOnly(today.Year, 1, 1), today),
        _ => throw new ArgumentOutOfRangeException(nameof(preset), preset, "Unknown changelog date preset."),
    };

    public ChangelogFilterResult Filter(ChangelogFilterOptions? options = null) =>
        FilterCore(options, TimeSpan.FromMilliseconds(RegexBuilderService.EvaluationTimeoutMilliseconds));

    internal ChangelogFilterResult FilterWithRegexTimeoutForTesting(
        ChangelogFilterOptions options, TimeSpan totalTimeout) => FilterCore(options, totalTimeout);

    private ChangelogFilterResult FilterCore(ChangelogFilterOptions? options, TimeSpan regexTotalTimeout)
    {
        options ??= new ChangelogFilterOptions();
        var range = options.DateRange ?? ChangelogDateRange.AllTime;
        var query = options.Query?.Trim() ?? "";
        var flags = options.RegexFlags ?? "";

        if (!range.IsValid)
            return InvalidFilter("The start date must be on or before the end date.", range, query,
                options.UseRegex, flags);
        if (query.Length > RegexBuilderService.MaxPatternLength)
            return InvalidFilter($"Search text is limited to {RegexBuilderService.MaxPatternLength} characters.",
                range, query, options.UseRegex, flags);

        var dateMatches = _releases.Where(release => range.Contains(release.ReleaseDate)).ToArray();
        if (query.Length == 0)
            return ValidFilter(dateMatches, range, query, options.UseRegex, flags);

        if (options.UseRegex)
        {
            var searchable = dateMatches.Select(BuildSearchText).ToArray();
            var evaluation = RegexBuilderService.EvaluateSearchSet(query, flags, searchable, regexTotalTimeout);
            if (!evaluation.IsValid)
                return InvalidFilter(evaluation.Error ?? "The regular expression is invalid.", range,
                    query, true, flags);
            var regexMatches = dateMatches.Where((_, index) => evaluation.Matches[index]).ToArray();
            return ValidFilter(regexMatches, range, query, true, flags);
        }

        var matches = new List<ChangelogRelease>();
        foreach (var release in dateMatches)
        {
            var searchable = BuildSearchText(release);
            if (searchable.Contains(query, StringComparison.CurrentCultureIgnoreCase))
            {
                matches.Add(release);
            }
        }

        return ValidFilter(matches, range, query, options.UseRegex, flags);
    }

    public string ExportFilteredViewMarkdown(ChangelogFilterResult filtered,
        ChangelogLanguage language = ChangelogLanguage.Bilingual,
        int englishFunnyLevel = 1, int cantoneseFunnyLevel = 1)
    {
        if (!filtered.IsValid)
            throw new InvalidOperationException("An invalid changelog filter cannot be exported: " + filtered.Error);

        return ExportMarkdown(filtered.Releases, filtered.DateRange, filtered.Query, filtered.UsesRegex,
            filtered.RegexFlags, language, englishFunnyLevel, cantoneseFunnyLevel);
    }

    public string ExportCurrentSelectionMarkdown(ChangelogRelease selected,
        ChangelogLanguage language = ChangelogLanguage.Bilingual,
        int englishFunnyLevel = 1, int cantoneseFunnyLevel = 1)
    {
        ArgumentNullException.ThrowIfNull(selected);
        var release = _releases.FirstOrDefault(candidate =>
            string.Equals(candidate.Tag, selected.Tag, StringComparison.Ordinal));
        if (release is null)
            throw new ArgumentException("The selected release is not part of this changelog.", nameof(selected));

        var exactDate = new ChangelogDateRange(release.ReleaseDate, release.ReleaseDate);
        return ExportMarkdown(new[] { release }, exactDate, "", false, "", language,
            englishFunnyLevel, cantoneseFunnyLevel);
    }

    private string ExportMarkdown(IEnumerable<ChangelogRelease> releases, ChangelogDateRange range,
        string query, bool usesRegex, string regexFlags, ChangelogLanguage language,
        int englishFunnyLevel, int cantoneseFunnyLevel)
    {
        var output = new StringBuilder();
        output.AppendLine(language switch
        {
            ChangelogLanguage.Cantonese => "# World Downloader 更新記錄",
            ChangelogLanguage.Bilingual => "# World Downloader changelog / World Downloader 更新記錄",
            _ => "# World Downloader changelog",
        });
        output.AppendLine();
        output.AppendLine($"- Source repository: `{SourceRepository}`");
        output.AppendLine($"- Exported date range: {range.ToIsoDescription()}");
        if (!string.IsNullOrEmpty(query))
        {
            var mode = usesRegex ? $".NET regex, flags `{EscapeInline(regexFlags)}`" : "plain text";
            output.AppendLine($"- Search: {mode} — `{EscapeInline(query)}`");
        }
        output.AppendLine();

        foreach (var release in releases)
        {
            output.AppendLine($"## {EscapeInline(release.Name)} (`{EscapeInline(release.Tag)}`)");
            output.AppendLine();
            output.AppendLine($"- Version: `{EscapeInline(release.Version)}`");
            output.AppendLine($"- Release date: {release.ReleaseDate:yyyy-MM-dd}");
            output.AppendLine($"- Release: {release.Url}");
            output.AppendLine();
            foreach (var category in release.Categories)
            {
                output.AppendLine($"### {category.Title.Resolve(language, " / ")}");
                output.AppendLine();
                foreach (var change in category.Changes)
                    output.AppendLine($"- {change.Text.ResolveStyled(language, englishFunnyLevel, cantoneseFunnyLevel, " / ")}");
                output.AppendLine();
            }
        }

        return output.ToString();
    }

    private static string BuildSearchText(ChangelogRelease release)
    {
        var output = new StringBuilder()
            .AppendLine(release.Tag)
            .AppendLine(release.Version)
            .AppendLine(release.Name)
            .AppendLine(release.Url)
            .AppendLine(release.SourceNotes);
        foreach (var category in release.Categories)
        {
            output.AppendLine(category.Id)
                .AppendLine(category.Title.English)
                .AppendLine(category.Title.Cantonese);
            foreach (var change in category.Changes)
                output.AppendLine(change.Text.English).AppendLine(change.Text.Cantonese);
        }
        return output.ToString();
    }

    private static void Validate(ChangelogDocument document)
    {
        if (!string.Equals(document.SourceRepository, ExpectedRepository, StringComparison.Ordinal))
            throw new InvalidDataException($"Changelog source must be '{ExpectedRepository}'.");
        if (document.Releases.Length == 0)
            throw new InvalidDataException("The changelog contains no releases.");

        var tags = new HashSet<string>(StringComparer.Ordinal);
        foreach (var release in document.Releases)
        {
            Require(release.Tag, "release tag");
            Require(release.Version, $"version for '{release.Tag}'");
            Require(release.Name, $"name for '{release.Tag}'");
            Require(release.Url, $"URL for '{release.Tag}'");
            Require(release.SourceNotes, $"source notes for '{release.Tag}'");
            if (release.PublishedAt == default)
                throw new InvalidDataException($"Release '{release.Tag}' has no publication date.");
            if (!Uri.TryCreate(release.Url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
                throw new InvalidDataException($"Release '{release.Tag}' has an invalid HTTPS URL.");
            if (!tags.Add(release.Tag))
                throw new InvalidDataException($"Duplicate changelog release tag '{release.Tag}'.");
            if (release.Categories.Length == 0)
                throw new InvalidDataException($"Release '{release.Tag}' has no categorized changes.");

            foreach (var category in release.Categories)
            {
                Require(category.Id, $"category id for '{release.Tag}'");
                ValidateLocalized(category.Title, $"category title '{category.Id}' in '{release.Tag}'");
                if (category.Changes.Length == 0)
                    throw new InvalidDataException($"Category '{category.Id}' in '{release.Tag}' is empty.");
                foreach (var change in category.Changes)
                    ValidateLocalized(change.Text, $"change in '{release.Tag}/{category.Id}'");
            }
        }
    }

    private static void ValidateLocalized(LocalizedChangelogText text, string description)
    {
        if (text is null) throw new InvalidDataException($"Missing {description}.");
        Require(text.English, $"English {description}");
        Require(text.Cantonese, $"Cantonese {description}");
    }

    private static void Require(string? value, string description)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidDataException($"Missing {description}.");
    }

    private static ChangelogFilterResult ValidFilter(IReadOnlyList<ChangelogRelease> releases,
        ChangelogDateRange range, string query, bool usesRegex, string flags) =>
        new(true, null, releases, range, query, usesRegex, flags);

    private static ChangelogFilterResult InvalidFilter(string error, ChangelogDateRange range,
        string query, bool usesRegex, string flags) =>
        new(false, error, Array.Empty<ChangelogRelease>(), range, query, usesRegex, flags);

    private static string EscapeInline(string value) => value
        .Replace("\\", "\\\\", StringComparison.Ordinal)
        .Replace("`", "\\`", StringComparison.Ordinal)
        .Replace("\r", " ", StringComparison.Ordinal)
        .Replace("\n", " ", StringComparison.Ordinal);
}
