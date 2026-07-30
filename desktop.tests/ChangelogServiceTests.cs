using System;
using System.Globalization;
using System.IO;
using System.Linq;
using WorldDownloaderManager;
using Xunit;

namespace WorldDownloaderManager.Tests;

public sealed class ChangelogServiceTests
{
    private static ChangelogService Load() => ChangelogService.LoadEmbedded();

    [Fact]
    public void EmbeddedCatalogContainsTheHistoricalBaselineAndValidHydratedReleases()
    {
        var service = Load();
        var tags = service.Releases.Select(release => release.Tag).ToArray();
        var highestBuild = service.Releases
            .Where(release => release.Tag.StartsWith("build-", StringComparison.Ordinal))
            .Max(release => int.Parse(release.Tag[6..], CultureInfo.InvariantCulture));
        Assert.True(highestBuild >= 59);

        Assert.Equal("Ding-Ding-Projects/minecraft-world-downloader", service.SourceRepository);
        Assert.Equal(tags.Length, tags.Distinct(StringComparer.Ordinal).Count());
        Assert.Contains("test-worlds", tags);
        foreach (var number in Enumerable.Range(4, 56)) Assert.Contains($"build-{number}", tags);
        Assert.All(tags.Where(tag => tag.StartsWith("build-", StringComparison.Ordinal) &&
                                     !Enumerable.Range(4, 56).Select(number => $"build-{number}").Contains(tag)),
            tag => Assert.True(int.Parse(tag[6..], CultureInfo.InvariantCulture) > 59));

        var build59 = Assert.Single(service.Releases, release => release.Tag == "build-59");
        Assert.Equal("1.0.59", build59.Version);
        Assert.Equal(new DateOnly(2026, 7, 30), build59.ReleaseDate);
        var newest = service.Releases[0];
        Assert.Equal($"build-{highestBuild}", newest.Tag);
        Assert.Equal($"{newest.ReleaseDate:yyyy-MM-dd} · {newest.Name} · {newest.Tag}", newest.DisplayName);

        var testWorlds = Assert.Single(service.Releases, release => release.Tag == "test-worlds");
        Assert.Equal(new DateOnly(2026, 6, 7), testWorlds.ReleaseDate);
        Assert.Equal("test-worlds", testWorlds.Version);
    }

    [Fact]
    public void EmbeddedEntriesRetainSourceNotesAndBilingualCategories()
    {
        var service = Load();

        Assert.All(service.Releases, release =>
        {
            Assert.False(string.IsNullOrWhiteSpace(release.SourceNotes));
            Assert.NotEmpty(release.Categories);
            Assert.All(release.Categories, category =>
            {
                Assert.False(string.IsNullOrWhiteSpace(category.Title.English));
                Assert.False(string.IsNullOrWhiteSpace(category.Title.Cantonese));
                Assert.NotEmpty(category.Changes);
                Assert.All(category.Changes, change =>
                {
                    Assert.False(string.IsNullOrWhiteSpace(change.Text.English));
                    Assert.False(string.IsNullOrWhiteSpace(change.Text.Cantonese));
                });
            });
        });

        var build = Assert.Single(service.Releases, release => release.Tag == "build-59");
        Assert.Contains("Automated all-in-one build.", build.SourceNotes);
        Assert.Contains("WorldDownloaderManager-Setup.exe", build.SourceNotes);
        Assert.Contains("source.zip", build.SourceNotes);

        var testWorlds = Assert.Single(service.Releases, release => release.Tag == "test-worlds");
        Assert.Contains("1.20.4 and 1.21.8", testWorlds.SourceNotes);
        Assert.Equal("verification", Assert.Single(testWorlds.Categories).Id);
    }

    [Fact]
    public void TypedDatesAcceptIsoAndCurrentLocaleFormats()
    {
        var iso = ChangelogService.ParseTypedDate("2026-07-29", CultureInfo.GetCultureInfo("fr-FR"));
        var local = ChangelogService.ParseTypedDate("7/29/2026", CultureInfo.GetCultureInfo("en-US"));
        var optional = ChangelogService.ParseOptionalTypedDate("   ", CultureInfo.GetCultureInfo("en-US"));

        Assert.True(iso.IsValid);
        Assert.Equal(new DateOnly(2026, 7, 29), iso.Value);
        Assert.True(local.IsValid);
        Assert.Equal(new DateOnly(2026, 7, 29), local.Value);
        Assert.True(optional.IsValid);
        Assert.Null(optional.Value);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not a date")]
    [InlineData("2026-02-31")]
    [InlineData("7/29")]
    public void TypedDatesReturnInlineValidationForInvalidInput(string input)
    {
        var result = ChangelogService.ParseTypedDate(input, CultureInfo.GetCultureInfo("en-CA"));

        Assert.False(result.IsValid);
        Assert.Null(result.Value);
        Assert.False(string.IsNullOrWhiteSpace(result.Error));
    }

    [Fact]
    public void DatePresetsUseInclusiveCalendarRanges()
    {
        var today = new DateOnly(2026, 7, 29);

        Assert.Equal(new ChangelogDateRange(new DateOnly(2026, 7, 23), today),
            ChangelogService.RangeForPreset(ChangelogDatePreset.Last7Days, today));
        Assert.Equal(new ChangelogDateRange(new DateOnly(2026, 6, 30), today),
            ChangelogService.RangeForPreset(ChangelogDatePreset.Last30Days, today));
        Assert.Equal(new ChangelogDateRange(new DateOnly(2025, 7, 30), today),
            ChangelogService.RangeForPreset(ChangelogDatePreset.Last365Days, today));
        Assert.Equal(new ChangelogDateRange(new DateOnly(2026, 7, 1), today),
            ChangelogService.RangeForPreset(ChangelogDatePreset.ThisMonth, today));
        Assert.Equal(new ChangelogDateRange(new DateOnly(2026, 1, 1), today),
            ChangelogService.RangeForPreset(ChangelogDatePreset.ThisYear, today));
    }

    [Fact]
    public void DateAndPlainTextFiltersComposeInclusively()
    {
        var service = Load();
        var range = new ChangelogDateRange(new DateOnly(2026, 7, 29), new DateOnly(2026, 7, 29));

        var result = service.Filter(new ChangelogFilterOptions(range, "source.zip"));

        Assert.True(result.IsValid, result.Error);
        Assert.Equal("build-58", Assert.Single(result.Releases).Tag);
    }

    [Fact]
    public void PlainTextSearchIncludesCantoneseFactualFields()
    {
        var result = Load().Filter(new ChangelogFilterOptions(Query: "完整原始碼快照"));

        Assert.True(result.IsValid, result.Error);
        Assert.Equal(Load().Releases.Count(release => release.Tag.StartsWith("build-", StringComparison.Ordinal)),
            result.Releases.Count);
        Assert.DoesNotContain(result.Releases, release => release.Tag == "test-worlds");
    }

    [Fact]
    public void RegexFilteringUsesTheBoundedDesktopRegexWorkbench()
    {
        var service = Load();
        var matches = service.Filter(new ChangelogFilterOptions(Query: @"build-(58|59)", UseRegex: true));
        var invalid = service.Filter(new ChangelogFilterOptions(Query: "(", UseRegex: true));
        var oversized = service.Filter(new ChangelogFilterOptions(
            Query: new string('a', RegexBuilderService.MaxPatternLength + 1), UseRegex: true));

        Assert.True(matches.IsValid, matches.Error);
        Assert.Equal(new[] { "build-59", "build-58" }, matches.Releases.Select(release => release.Tag));
        Assert.False(invalid.IsValid);
        Assert.Contains("Invalid pattern", invalid.Error!, StringComparison.OrdinalIgnoreCase);
        Assert.False(oversized.IsValid);
        Assert.Contains(RegexBuilderService.MaxPatternLength.ToString(CultureInfo.InvariantCulture), oversized.Error!);
    }

    [Fact]
    public void RegexFilteringHasOneCatalogWideDeadlineAndReturnsNoPartialResults()
    {
        var result = Load().FilterWithRegexTimeoutForTesting(
            new ChangelogFilterOptions(Query: "build", UseRegex: true), TimeSpan.Zero);

        Assert.False(result.IsValid);
        Assert.Empty(result.Releases);
        Assert.Contains($"{RegexBuilderService.EvaluationTimeoutMilliseconds} ms safety limit", result.Error!);
    }

    [Fact]
    public void ReversedDateRangeIsRejectedWithoutPartialResults()
    {
        var range = new ChangelogDateRange(new DateOnly(2026, 7, 30), new DateOnly(2026, 7, 29));

        var result = Load().Filter(new ChangelogFilterOptions(range));

        Assert.False(result.IsValid);
        Assert.Empty(result.Releases);
        Assert.Contains("start date", result.Error!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void FilteredMarkdownExportStatesExactInclusiveRangeAndQuery()
    {
        var service = Load();
        var range = new ChangelogDateRange(new DateOnly(2026, 7, 29), new DateOnly(2026, 7, 30));
        var filtered = service.Filter(new ChangelogFilterOptions(range, @"build-5[89]", true, "i"));

        var markdown = service.ExportFilteredViewMarkdown(filtered, ChangelogLanguage.Bilingual);

        Assert.Contains("Exported date range: 2026-07-29 through 2026-07-30 (inclusive)", markdown);
        Assert.Contains("Search: .NET regex, flags `i`", markdown);
        Assert.Contains("All-in-one build 1.0.59", markdown);
        Assert.Contains("All-in-one build 1.0.58", markdown);
        Assert.DoesNotContain("All-in-one build 1.0.57", markdown);
        Assert.Contains("Included artifacts / 隨附發佈檔案", markdown);
    }

    [Fact]
    public void CurrentSelectionMarkdownUsesThatReleasesExactDate()
    {
        var service = Load();
        var selected = Assert.Single(service.Releases, release => release.Tag == "test-worlds");

        var markdown = service.ExportCurrentSelectionMarkdown(selected, ChangelogLanguage.English);

        Assert.Contains("Exported date range: 2026-06-07 through 2026-06-07 (inclusive)", markdown);
        Assert.Contains("Test worlds (auto-open verification)", markdown);
        Assert.DoesNotContain("All-in-one build", markdown);
    }

    [Fact]
    public void FunnyLevelsStyleBothLanguagesWithoutChangingReleaseFacts()
    {
        var service = Load();
        var selected = Assert.Single(service.Releases, release => release.Tag == "build-59");

        var serious = service.ExportCurrentSelectionMarkdown(
            selected, ChangelogLanguage.Bilingual, englishFunnyLevel: 1, cantoneseFunnyLevel: 1);
        var playful = service.ExportCurrentSelectionMarkdown(
            selected, ChangelogLanguage.Bilingual, englishFunnyLevel: 5, cantoneseFunnyLevel: 5);

        Assert.DoesNotContain("chunk oven", serious);
        Assert.DoesNotContain("方塊焗爐", serious);
        Assert.Contains("Fresh from the chunk oven:", playful);
        Assert.Contains("啱啱由方塊焗爐出爐：", playful);
        Assert.Contains("build-59", playful);
        Assert.Contains("2026-07-30", playful);
        Assert.Contains(selected.Url, playful);
    }

    [Fact]
    public void InvalidEmbeddedJsonIsRejected()
    {
        Assert.Throws<InvalidDataException>(() => ChangelogService.ParseDocument("not json"));
    }
}
