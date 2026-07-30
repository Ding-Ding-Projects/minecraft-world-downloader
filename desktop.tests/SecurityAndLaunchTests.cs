using System;
using System.IO;
using System.Linq;
using WorldDownloaderManager;
using Xunit;

namespace WorldDownloaderManager.Tests;

public sealed class SecurityAndLaunchTests
{
    private const string ConsoleSample = "synthetic-console-value";
    private const string BotSample = "synthetic-bot-value";

    [Fact]
    public void DockerAndComposeBindWebToLoopbackButLeaveProxyHostWideByDefault()
    {
        var settings = new Settings { DataFolder = @"C:\Worlds", WebPort = 8181, ProxyPort = 25570 };

        var arguments = DockerService.BuildRunArguments(settings);
        var compose = settings.ToDockerCompose();

        Assert.Contains("127.0.0.1:8181:8080", arguments);
        Assert.Contains("25570:25565", arguments);
        Assert.Contains("\"127.0.0.1:8181:8080\"", compose);
        Assert.Contains("\"25570:25565\"", compose);
    }

    [Fact]
    public void ExplicitLanOptInPublishesWebPortHostWideInDockerAndCompose()
    {
        var settings = new Settings
        {
            DataFolder = @"C:\Worlds",
            WebPort = 8181,
            ExposeWebToLan = true,
            RequireLogin = true,
            Password = ConsoleSample,
        };

        var arguments = DockerService.BuildRunArguments(settings);
        var compose = settings.ToDockerCompose();

        Assert.Contains("8181:8080", arguments);
        Assert.DoesNotContain("127.0.0.1:8181:8080", arguments);
        Assert.Contains("\"8181:8080\"", compose);
    }

    [Fact]
    public void LanExposureWithoutAuthenticationIsRejectedEverywhere()
    {
        var settings = new Settings
        {
            DataFolder = @"C:\Worlds",
            ExposeWebToLan = true,
            RequireLogin = false,
        };

        Assert.Throws<InvalidOperationException>(() => settings.GetContainerEnvironment());
        Assert.Throws<InvalidOperationException>(() => DockerService.BuildRunArguments(settings));
        Assert.Throws<InvalidOperationException>(() => settings.ToDockerCompose());
    }

    [Fact]
    public void DockerAndComposeUseTheSameDownloaderEnvironment()
    {
        var settings = new Settings
        {
            DataFolder = @"C:\Worlds",
            Server = "play.example.test",
            OutputDir = "downloaded-world",
            AutoStart = true,
        };

        var environment = settings.GetContainerEnvironment();
        var arguments = DockerService.BuildRunArguments(settings);
        var compose = settings.ToDockerCompose();

        foreach (var item in environment)
        {
            Assert.Contains($"{item.Key}={item.Value}", arguments);
            Assert.Contains($"{item.Key}: {Settings.YamlString(item.Value)}", compose);
        }

        Assert.Contains(environment, item => item.Key == "MWD_SERVER");
        Assert.Contains(environment, item => item.Key == "MWD_WORLD_OUTPUT_DIR");
        Assert.Contains(environment, item => item is { Key: "MWD_AUTOSTART", Value: "true" });
    }

    [Fact]
    public void RequestedAuthenticationWithoutPasswordBlocksDockerAndCompose()
    {
        var settings = new Settings { DataFolder = @"C:\Worlds", RequireLogin = true };

        Assert.Throws<InvalidOperationException>(() => DockerService.BuildRunArguments(settings));
        Assert.Throws<InvalidOperationException>(() => settings.ToDockerCompose());
    }

    [Fact]
    public void CorruptProtectedPasswordIsDetectedAndBlocksDockerAndCompose()
    {
        var settings = new Settings
        {
            DataFolder = @"C:\Worlds",
            RequireLogin = true,
            EncryptedPassword = "not-valid-protected-data",
        };

        Assert.True(settings.IsPasswordUnreadable);
        Assert.False(settings.TryGetPassword(out _));
        Assert.Throws<InvalidOperationException>(() => DockerService.BuildRunArguments(settings));
        Assert.Throws<InvalidOperationException>(() => settings.ToDockerCompose());
    }

    [Fact]
    public void AssigningUnchangedSecretsPreservesCiphertext()
    {
        var settings = new Settings { Password = ConsoleSample, BotLoginPassword = BotSample };
        var consoleCipher = settings.EncryptedPassword;
        var botCipher = settings.EncryptedBotLoginPassword;

        settings.Password = ConsoleSample;
        settings.BotLoginPassword = BotSample;

        Assert.Equal(consoleCipher, settings.EncryptedPassword);
        Assert.Equal(botCipher, settings.EncryptedBotLoginPassword);
        Assert.False(settings.IsPasswordUnreadable);
        Assert.False(settings.IsBotLoginPasswordUnreadable);
    }

    [Fact]
    public void AtomicJsonRoundTripPreservesProfilesAndProtectedSecrets()
    {
        var directory = Path.Combine(Path.GetTempPath(), "mwd-settings-tests", Guid.NewGuid().ToString("N"));
        var path = Path.Combine(directory, "settings.json");
        try
        {
            var settings = new Settings
            {
                DataFolder = @"C:\Worlds",
                WebPort = 8181,
                ProxyPort = 25570,
                ExposeWebToLan = true,
                Server = "play.example.test",
                OutputDir = "downloaded-world",
                AutoStart = true,
                Password = ConsoleSample,
                ServerJarPath = @"C:\Tools\server.jar",
                BlueMapThreads = 3,
                BlueMapPort = 8111,
                BlueMapOverworld = false,
                BlueMapNether = true,
                BlueMapEnd = false,
                BotAuth = "microsoft",
                BotUsername = "TestAccount",
                BotRadius = 384,
                BotCount = 2,
                BotLoginPassword = BotSample,
                BotCenterOnSpawn = false,
                BotPreferFly = true,
                BotRevisit = true,
                BuildLocally = true,
                BuildContext = @"C:\Source",
            };

            Assert.True(settings.TrySaveToPath(path, out var firstError), firstError);
            var json = File.ReadAllText(path);
            Assert.DoesNotContain(ConsoleSample, json);
            Assert.DoesNotContain(BotSample, json);
            Assert.DoesNotContain("\"EffectiveImage\"", json);

            var restored = Settings.FromJson(json);
            Assert.True(restored.ExposeWebToLan);
            Assert.Equal("play.example.test", restored.Server);
            Assert.Equal("downloaded-world", restored.OutputDir);
            Assert.True(restored.AutoStart);
            Assert.Equal(@"C:\Tools\server.jar", restored.ServerJarPath);
            Assert.Equal(3, restored.BlueMapThreads);
            Assert.Equal(8111, restored.BlueMapPort);
            Assert.False(restored.BlueMapOverworld);
            Assert.True(restored.BlueMapNether);
            Assert.False(restored.BlueMapEnd);
            Assert.Equal("microsoft", restored.BotAuth);
            Assert.Equal(384, restored.BotRadius);
            Assert.Equal(2, restored.BotCount);
            Assert.False(restored.BotCenterOnSpawn);
            Assert.True(restored.BotPreferFly);
            Assert.True(restored.BotRevisit);
            Assert.Equal(ConsoleSample, restored.Password);
            Assert.Equal(BotSample, restored.BotLoginPassword);

            restored.BotRadius = 512;
            Assert.True(restored.TrySaveToPath(path, out var secondError), secondError);
            Assert.Equal(512, Settings.FromJson(File.ReadAllText(path)).BotRadius);
            Assert.Empty(Directory.EnumerateFiles(directory, "*.tmp", SearchOption.TopDirectoryOnly));
        }
        finally
        {
            if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
        }
    }

    [Fact]
    public void CorruptBotPasswordIsDistinguishedFromAnEmptyPassword()
    {
        var corrupt = new Settings { EncryptedBotLoginPassword = "not-valid-protected-data" };
        var empty = new Settings();

        Assert.True(corrupt.IsBotLoginPasswordUnreadable);
        Assert.False(corrupt.TryGetBotLoginPassword(out _));
        Assert.False(empty.IsBotLoginPasswordUnreadable);
        Assert.True(empty.TryGetBotLoginPassword(out var emptyValue));
        Assert.Empty(emptyValue);
    }

    [Fact]
    public void EmptyUiInputPreservesUnreadableProtectedPasswordsUntilExplicitReplacement()
    {
        var settings = new Settings
        {
            EncryptedPassword = "not-valid-console-data",
            EncryptedBotLoginPassword = "not-valid-bot-data",
        };
        var consoleCipher = settings.EncryptedPassword;
        var botCipher = settings.EncryptedBotLoginPassword;

        Assert.False(settings.UpdatePasswordFromInput(""));
        Assert.False(settings.UpdateBotLoginPasswordFromInput(""));
        Assert.Equal(consoleCipher, settings.EncryptedPassword);
        Assert.Equal(botCipher, settings.EncryptedBotLoginPassword);
        Assert.True(settings.IsPasswordUnreadable);
        Assert.True(settings.IsBotLoginPasswordUnreadable);

        Assert.True(settings.UpdatePasswordFromInput(ConsoleSample));
        Assert.True(settings.UpdateBotLoginPasswordFromInput(BotSample));
        Assert.Equal(ConsoleSample, settings.Password);
        Assert.Equal(BotSample, settings.BotLoginPassword);

        var explicitlyCleared = new Settings
        {
            EncryptedPassword = "not-valid-console-data",
            EncryptedBotLoginPassword = "not-valid-bot-data",
        };
        Assert.True(explicitlyCleared.UpdatePasswordFromInput("", explicitlyEdited: true));
        Assert.True(explicitlyCleared.UpdateBotLoginPasswordFromInput("", explicitlyEdited: true));
        Assert.Empty(explicitlyCleared.EncryptedPassword);
        Assert.Empty(explicitlyCleared.EncryptedBotLoginPassword);
    }
}
