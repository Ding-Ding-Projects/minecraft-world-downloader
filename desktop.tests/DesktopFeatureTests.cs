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
}
