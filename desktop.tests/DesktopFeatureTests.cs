using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using WorldDownloaderManager;
using Xunit;

namespace WorldDownloaderManager.Tests;

public class DesktopFeatureTests
{
    [Fact]
    public void DockerLogRedactsSensitiveEnvironmentValues()
    {
        var line = DockerService.FormatArgumentsForLog(new[]
        {
            "run", "-e", "WEB_USERNAME=admin", "-e", "WEB_PASSWORD=definitely-not-for-logs",
            "-e", "API_TOKEN=also-private", "image"
        });

        Assert.Contains("WEB_USERNAME=admin", line);
        Assert.Contains("WEB_PASSWORD=<redacted>", line);
        Assert.Contains("API_TOKEN=<redacted>", line);
        Assert.DoesNotContain("definitely-not-for-logs", line);
        Assert.DoesNotContain("also-private", line);
    }

    [Fact]
    public void ComposeQuotesUntrustedYamlScalars()
    {
        var settings = new Settings
        {
            DataFolder = "C:\\Worlds\nextra: nope",
            Image = "image\"name\nservices: injected",
            ContainerName = "safe\nprivileged: true",
            Server = "example.org\nports: [evil]",
            OutputDir = "world\tname",
        };

        var compose = settings.ToDockerCompose();

        Assert.Contains("image: \"image\\\"name\\nservices: injected\"", compose);
        Assert.Contains("container_name: \"safe\\nprivileged: true\"", compose);
        Assert.Contains("MWD_SERVER: \"example.org\\nports: [evil]\"", compose);
        Assert.DoesNotContain("\nprivileged: true\n", compose);
    }

    [Fact]
    public void RegexBuilderReportsMatchesAndCaptureGroups()
    {
        var result = RegexBuilderService.Evaluate(@"(?<word>café)", "im", "First\nCAFÉ\nlast");

        Assert.True(result.IsValid);
        var match = Assert.Single(result.Matches);
        Assert.Equal("CAFÉ", match.Value);
        Assert.Contains(match.Captures, capture => capture.Name == "word" && capture.Value == "CAFÉ");
    }

    [Theory]
    [InlineData("(", "", false)]
    [InlineData("^$", "", true)]
    [InlineData("a", "x", false)]
    public void RegexBuilderReturnsInlineValidation(string pattern, string flags, bool valid)
    {
        Assert.Equal(valid, RegexBuilderService.Evaluate(pattern, flags, "sample").IsValid);
    }

    [Fact]
    public void RegexBuilderHandlesZeroWidthAndBoundsResults()
    {
        var result = RegexBuilderService.Evaluate(@"(?=a)", "", new string('a', 600));
        Assert.True(result.IsValid);
        Assert.Equal(RegexBuilderService.MaxMatches, result.Matches.Count);
        Assert.All(result.Matches, match => Assert.Equal(0, match.Length));
    }

    [Fact]
    public void LocalizationKeepsBothLanguagesAndIndependentHumour()
    {
        var text = AppCopy.Get("stopped", "Bilingual", 1, 5);
        Assert.Contains("Select Start", text);
        Assert.Contains("按「開始」", text);
        Assert.DoesNotContain("goblin", text);
        Assert.Contains("吉祥扳手", text);

        var englishLevels = Enumerable.Range(1, 5)
            .Select(level => AppCopy.Get("settingsSaved", "English", level, 1));
        var cantoneseLevels = Enumerable.Range(1, 5)
            .Select(level => AppCopy.Get("settingsSaved", "Cantonese", 1, level));
        Assert.Equal(5, englishLevels.Distinct().Count());
        Assert.Equal(5, cantoneseLevels.Distinct().Count());
    }

    [Fact]
    public void SettingsSerializeOnlyTheProtectedPassword()
    {
        var settings = new Settings { Password = "never-write-this-clear-value" };

        var json = JsonSerializer.Serialize(settings);
        var restored = JsonSerializer.Deserialize<Settings>(json)!;

        Assert.DoesNotContain("\"Password\":", json);
        Assert.DoesNotContain("never-write-this-clear-value", json);
        Assert.NotEmpty(restored.EncryptedPassword);
        Assert.Equal("never-write-this-clear-value", restored.Password);
    }

    [Fact]
    public void RegexBuilderStopsCatastrophicBacktracking()
    {
        var result = RegexBuilderService.Evaluate("(a+)+$", "", new string('a', 12_000) + "!");

        Assert.False(result.IsValid);
        Assert.Contains("safety limit", result.Error);
    }

    [Fact]
    public void LocalHistoryIsAppendOnlyAndSuppressesUnchangedSnapshots()
    {
        using var sandbox = new TemporaryDirectory();
        var history = new LocalHistoryService(sandbox.Path);
        var first = JsonSerializer.Serialize(new Settings { WebPort = 8080 });
        var second = JsonSerializer.Serialize(new Settings { WebPort = 9090 });

        Assert.NotNull(history.RecordSettingsSnapshot(first));
        Assert.Null(history.RecordSettingsSnapshot(first));
        Assert.NotNull(history.RecordSettingsSnapshot(second));

        var revisions = history.GetRevisions();
        Assert.Equal(2, revisions.Count);
        Assert.Contains("web console port", revisions[0].Message);
        Assert.Contains("revision: 8080", history.DiffAgainst(revisions[1].Sha, second));
    }

    [Fact]
    public void LocalHistoryLabelsRestoresAndPrunesWithoutARemote()
    {
        using var sandbox = new TemporaryDirectory();
        var history = new LocalHistoryService(sandbox.Path);
        for (var port = 8080; port < 8084; port++)
            history.RecordSettingsSnapshot(JsonSerializer.Serialize(new Settings { WebPort = port }));

        var oldest = history.GetRevisions().Last();
        history.LabelRevision(oldest.Sha, "Before port experiments");
        var labeledRevision = history.GetRevisions().Single(revision => revision.Sha == oldest.Sha);
        Assert.True(labeledRevision.Label == "Before port experiments",
            $"Label file: {File.ReadAllText(Path.Combine(history.RepositoryPath, "labels.json"))}; " +
            $"revision: {JsonSerializer.Serialize(labeledRevision)}");
        Assert.Contains("8080", history.GetSnapshot(oldest.Sha));
        Assert.Equal(2, history.PruneToLatest(2));
        Assert.Equal(2, history.GetRevisions().Count);
        using var repository = new LibGit2Sharp.Repository(history.RepositoryPath);
        Assert.Empty(repository.Network.Remotes);
    }

    [Fact]
    public void LocalHistoryNeverDisplaysProtectedCiphertext()
    {
        const string oldCipher = "cipher-one-must-not-appear";
        const string newCipher = "cipher-two-must-not-appear";
        var oldJson = JsonSerializer.Serialize(new Settings { EncryptedPassword = oldCipher });
        var newJson = JsonSerializer.Serialize(new Settings { EncryptedPassword = newCipher });

        var diff = LocalHistoryService.FormatJsonDiff(oldJson, newJson);

        Assert.Contains("protected value changed", diff);
        Assert.DoesNotContain(oldCipher, diff);
        Assert.DoesNotContain(newCipher, diff);
    }
}

internal sealed class TemporaryDirectory : IDisposable
{
    public TemporaryDirectory()
    {
        Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "mwd-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path);
    }

    public string Path { get; }

    public void Dispose()
    {
        if (!Directory.Exists(Path)) return;
        foreach (var file in Directory.EnumerateFiles(Path, "*", SearchOption.AllDirectories))
            File.SetAttributes(file, FileAttributes.Normal);
        Directory.Delete(Path, true);
    }
}
