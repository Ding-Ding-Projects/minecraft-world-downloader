using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WorldDownloaderManager;

public class Settings
{
    public string DataFolder { get; set; } = "";
    public int WebPort { get; set; } = 8080;
    public int ProxyPort { get; set; } = 25565;
    public bool ExposeWebToLan { get; set; }

    /// <summary>Remote Minecraft server to download from (hostname/IP, no port).</summary>
    public string Server { get; set; } = "";
    public string OutputDir { get; set; } = "world";
    public bool AutoStart { get; set; }
    public string Image { get; set; } = "ghcr.io/cafepromenade/minecraft-world-downloader-web:latest";
    public string ContainerName { get; set; } = "minecraft-world-downloader";
    public bool RequireLogin { get; set; }
    public string Username { get; set; } = "admin";

    /// <summary>The console password is protected for the current Windows user. Assigning the
    /// unchanged value preserves the existing ciphertext so unchanged settings do not create noise.</summary>
    [JsonIgnore]
    public string Password
    {
        get => TryGetPassword(out var value) ? value : "";
        set => EncryptedPassword = ProtectIfChanged(EncryptedPassword, value, ConsolePasswordEntropy);
    }

    public string EncryptedPassword { get; set; } = "";

    [JsonIgnore]
    public bool IsPasswordUnreadable =>
        !string.IsNullOrWhiteSpace(EncryptedPassword) && !TryGetPassword(out _);

    // Persisted language, appearance and app-integration preferences.
    public string LanguageMode { get; set; } = "English";
    public int EnglishFunnyLevel { get; set; } = 2;
    public int CantoneseFunnyLevel { get; set; } = 3;
    public bool DimSumSurpriseEnabled { get; set; } = true;
    public bool HasCompletedFirstRun { get; set; }
    public string Theme { get; set; } = "Dark";
    public bool LargeText { get; set; }
    public string AccentColor { get; set; } = "#6750A4";
    public string UiFontFamily { get; set; } = "Segoe UI";
    public double UiFontScale { get; set; } = 1.0;
    public string ExternalEditorPath { get; set; } = "";

    // BlueMap profile. These fields belong in the same recoverable settings snapshot as the rest
    // of the app-managed state.
    public string ServerJarPath { get; set; } = "";
    public int BlueMapThreads { get; set; }
    public int BlueMapPort { get; set; } = 8100;
    public bool BlueMapOverworld { get; set; } = true;
    public bool BlueMapNether { get; set; } = true;
    public bool BlueMapEnd { get; set; } = true;

    // Auto-explore profile. The AuthMe password uses a distinct DPAPI entropy domain.
    public string BotAuth { get; set; } = "offline";
    public string BotUsername { get; set; } = "Scraper";
    public int BotRadius { get; set; } = 256;
    public int BotCount { get; set; } = 1;

    [JsonIgnore]
    public string BotLoginPassword
    {
        get => TryGetBotLoginPassword(out var value) ? value : "";
        set => EncryptedBotLoginPassword = ProtectIfChanged(
            EncryptedBotLoginPassword, value, BotLoginPasswordEntropy);
    }

    public string EncryptedBotLoginPassword { get; set; } = "";

    [JsonIgnore]
    public bool IsBotLoginPasswordUnreadable =>
        !string.IsNullOrWhiteSpace(EncryptedBotLoginPassword) && !TryGetBotLoginPassword(out _);

    public bool BotCenterOnSpawn { get; set; } = true;
    public bool BotPreferFly { get; set; }
    public bool BotRevisit { get; set; }

    /// <summary>Build the image locally from source instead of pulling the prebuilt one.</summary>
    public bool BuildLocally { get; set; }
    public string BuildContext { get; set; } = "";

    public const string LocalImageTag = "minecraft-world-downloader-web:local";

    [JsonIgnore]
    public string EffectiveImage => BuildLocally ? LocalImageTag : Image;

    [JsonIgnore]
    internal string WebPortBinding =>
        ExposeWebToLan ? $"{WebPort}:8080" : $"127.0.0.1:{WebPort}:8080";

    private static readonly JsonSerializerOptions IndentedJsonOptions = new() { WriteIndented = true };
    private static readonly byte[] ConsolePasswordEntropy = Encoding.UTF8.GetBytes(
        "WorldDownloaderManager.ConsolePassword.v1");
    private static readonly byte[] BotLoginPasswordEntropy = Encoding.UTF8.GetBytes(
        "WorldDownloaderManager.BotLoginPassword.v1");

    private static string FilePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "WorldDownloaderManager",
        "settings.json");

    public bool TryGetPassword(out string value) =>
        TryUnprotect(EncryptedPassword, ConsolePasswordEntropy, out value);

    public bool TryGetBotLoginPassword(out string value) =>
        TryUnprotect(EncryptedBotLoginPassword, BotLoginPasswordEntropy, out value);

    /// <summary>
    /// Applies the password currently shown by the UI without destroying ciphertext that this
    /// Windows user cannot decrypt. An unreadable value is displayed as an empty PasswordBox, so
    /// an unchanged empty input means "leave it for recovery", while any non-empty input is an
    /// explicit replacement.
    /// </summary>
    public bool UpdatePasswordFromInput(string? value, bool explicitlyEdited = false)
    {
        value ??= "";
        if (IsPasswordUnreadable && value.Length == 0 && !explicitlyEdited) return false;
        Password = value;
        return true;
    }

    /// <summary>Bot-password counterpart to <see cref="UpdatePasswordFromInput"/>.</summary>
    public bool UpdateBotLoginPasswordFromInput(string? value, bool explicitlyEdited = false)
    {
        value ??= "";
        if (IsBotLoginPasswordUnreadable && value.Length == 0 && !explicitlyEdited) return false;
        BotLoginPassword = value;
        return true;
    }

    private static string ProtectIfChanged(string? encryptedValue, string? newValue, byte[] entropy)
    {
        newValue ??= "";
        if (TryUnprotect(encryptedValue, entropy, out var currentValue) &&
            string.Equals(currentValue, newValue, StringComparison.Ordinal))
            return encryptedValue ?? "";
        return Protect(newValue, entropy);
    }

    private static string Protect(string value, byte[] entropy)
    {
        if (string.IsNullOrEmpty(value)) return "";
        var clear = Encoding.UTF8.GetBytes(value);
        try
        {
            return Convert.ToBase64String(ProtectedData.Protect(
                clear, entropy, DataProtectionScope.CurrentUser));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(clear);
        }
    }

    private static bool TryUnprotect(string? value, byte[] entropy, out string clearText)
    {
        clearText = "";
        if (string.IsNullOrWhiteSpace(value)) return true;
        byte[]? encrypted = null;
        byte[]? clear = null;
        try
        {
            encrypted = Convert.FromBase64String(value);
            clear = ProtectedData.Unprotect(encrypted, entropy, DataProtectionScope.CurrentUser);
            clearText = Encoding.UTF8.GetString(clear);
            return true;
        }
        catch (CryptographicException)
        {
            return false;
        }
        catch (FormatException)
        {
            return false;
        }
        finally
        {
            if (encrypted is not null) CryptographicOperations.ZeroMemory(encrypted);
            if (clear is not null) CryptographicOperations.ZeroMemory(clear);
        }
    }

    public static Settings Load()
    {
        Settings settings = new();
        try
        {
            if (File.Exists(FilePath))
            {
                var json = File.ReadAllText(FilePath);
                bool needsLegacyPasswordMigration = HasLegacyPasswordWithoutCipher(json);
                settings = FromJson(json);
                if (needsLegacyPasswordMigration)
                    settings.TrySave(out _);
            }
        }
        catch
        {
            // Keep startup usable with defaults. Callers can distinguish unreadable protected fields
            // on an otherwise valid settings document through the explicit status properties.
        }

        settings.Normalize();
        return settings;
    }

    public string ToJson() => JsonSerializer.Serialize(this, IndentedJsonOptions);

    public static Settings FromJson(string json)
    {
        ArgumentNullException.ThrowIfNull(json);
        var settings = JsonSerializer.Deserialize<Settings>(json) ?? new Settings();

        if (string.IsNullOrWhiteSpace(settings.EncryptedPassword))
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.TryGetProperty("Password", out var oldPassword) &&
                oldPassword.ValueKind == JsonValueKind.String)
                settings.Password = oldPassword.GetString() ?? "";
        }

        settings.Normalize();
        return settings;
    }

    private static bool HasLegacyPasswordWithoutCipher(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        bool hasCipher = root.TryGetProperty("EncryptedPassword", out var cipher) &&
                         cipher.ValueKind == JsonValueKind.String &&
                         !string.IsNullOrWhiteSpace(cipher.GetString());
        return !hasCipher && root.TryGetProperty("Password", out var password) &&
               password.ValueKind == JsonValueKind.String;
    }

    private void Normalize()
    {
        DataFolder ??= "";
        Server ??= "";
        OutputDir = string.IsNullOrWhiteSpace(OutputDir) ? "world" : OutputDir;
        Image ??= "";
        ContainerName ??= "";
        Username ??= "";
        EncryptedPassword ??= "";
        LanguageMode ??= "English";
        Theme ??= "Dark";
        AccentColor ??= "#6750A4";
        UiFontFamily ??= "Segoe UI";
        ExternalEditorPath ??= "";
        BuildContext ??= "";
        ServerJarPath ??= "";
        BotAuth ??= "offline";
        BotUsername ??= "Scraper";
        EncryptedBotLoginPassword ??= "";

        if (Image == "ghcr.io/cafepromenade/minecraft-world-downloader:latest")
            Image = "ghcr.io/cafepromenade/minecraft-world-downloader-web:latest";

        EnglishFunnyLevel = Math.Clamp(EnglishFunnyLevel, 1, 5);
        CantoneseFunnyLevel = Math.Clamp(CantoneseFunnyLevel, 1, 5);
        UiFontScale = Math.Clamp(UiFontScale, 0.75, 2.0);
        BlueMapThreads = Math.Max(0, BlueMapThreads);
        BlueMapPort = BlueMapPort is > 0 and < 65536 ? BlueMapPort : 8100;
        BotRadius = Math.Max(1, BotRadius);
        BotCount = Math.Max(1, BotCount);
    }

    public bool TrySave(out string error) => TrySaveToPath(FilePath, out error);

    internal bool TrySaveToPath(string path, out string error)
    {
        string? temporaryPath = null;
        try
        {
            if (string.IsNullOrWhiteSpace(path)) throw new ArgumentException("A settings path is required.", nameof(path));
            var fullPath = Path.GetFullPath(path);
            var directory = Path.GetDirectoryName(fullPath) ?? throw new IOException("The settings directory is unavailable.");
            Directory.CreateDirectory(directory);
            temporaryPath = Path.Combine(directory, $".{Path.GetFileName(fullPath)}.{Guid.NewGuid():N}.tmp");

            using (var stream = new FileStream(
                       temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                       bufferSize: 4096, FileOptions.WriteThrough))
            using (var writer = new StreamWriter(stream, new UTF8Encoding(false)))
            {
                writer.Write(ToJson());
                writer.Flush();
                stream.Flush(flushToDisk: true);
            }

            File.Move(temporaryPath, fullPath, overwrite: true);
            temporaryPath = null;
            error = "";
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
        finally
        {
            if (temporaryPath is not null)
            {
                try { File.Delete(temporaryPath); } catch { /* best-effort cleanup */ }
            }
        }
    }

    /// <summary>Compatibility wrapper for existing callers. New UI paths should use TrySave so a
    /// failure can be surfaced as a persistent, non-blocking notification.</summary>
    public void Save() => TrySave(out _);

    /// <summary>The canonical environment shared by docker run and generated Compose output.</summary>
    internal IReadOnlyList<KeyValuePair<string, string>> GetContainerEnvironment()
    {
        if (ExposeWebToLan && !RequireLogin)
            throw new InvalidOperationException(
                "LAN exposure requires console login protection. Enable login and set a password before exposing the web console.");

        var environment = new List<KeyValuePair<string, string>>
        {
            new("WEB_PORT", "8080"),
        };

        if (RequireLogin)
        {
            if (!TryGetPassword(out var password))
                throw new InvalidOperationException(
                    "Console login is enabled, but its protected password cannot be read. Enter it again before starting.");
            if (string.IsNullOrWhiteSpace(password))
                throw new InvalidOperationException(
                    "Console login is enabled, but no password is set. Enter a password before starting.");
            environment.Add(new("WEB_USERNAME", Username.Trim()));
            environment.Add(new("WEB_PASSWORD", password));
        }

        if (!string.IsNullOrWhiteSpace(Server))
            environment.Add(new("MWD_SERVER", Server.Trim()));
        environment.Add(new("MWD_WORLD_OUTPUT_DIR",
            string.IsNullOrWhiteSpace(OutputDir) ? "world" : OutputDir.Trim()));
        environment.Add(new("MWD_AUTOSTART", AutoStart ? "true" : "false"));
        return environment;
    }

    /// <summary>Render a docker-compose.yml equivalent to the current settings.</summary>
    public string ToDockerCompose()
    {
        var dataPath = DataFolder.Replace("\\", "/");
        var sb = new StringBuilder();
        sb.AppendLine("# docker-compose.yml generated by World Downloader Manager.");
        sb.AppendLine("#");
        sb.AppendLine("# Start it from this folder with:");
        sb.AppendLine(BuildLocally ? "#     docker compose up -d --build" : "#     docker compose up -d");
        sb.AppendLine($"# then open the web console at http://localhost:{WebPort} and point your Minecraft");
        sb.AppendLine($"# client at  localhost:{ProxyPort}.  The image launches the web console automatically");
        sb.AppendLine("# (it is the container's entrypoint) — no extra 'command:' is needed here.");
        sb.AppendLine("services:");
        sb.AppendLine("  world-downloader:");
        if (BuildLocally)
        {
            var context = (string.IsNullOrWhiteSpace(BuildContext) ? "." : BuildContext).Replace("\\", "/");
            sb.AppendLine($"    build: {YamlString(context)}   # build locally (must contain the Dockerfile)");
            sb.AppendLine($"    image: {YamlString(LocalImageTag)}");
        }
        else
        {
            sb.AppendLine($"    image: {YamlString(Image)}");
            sb.AppendLine("    pull_policy: always");
        }
        sb.AppendLine($"    container_name: {YamlString(ContainerName)}");
        sb.AppendLine("    restart: unless-stopped");
        sb.AppendLine("    ports:");
        sb.AppendLine($"      - {YamlString(WebPortBinding)}      # web console");
        sb.AppendLine($"      - {YamlString($"{ProxyPort}:25565")}    # Minecraft proxy");
        sb.AppendLine("    environment:");
        foreach (var item in GetContainerEnvironment())
            sb.AppendLine($"      {item.Key}: {YamlString(item.Value)}");
        sb.AppendLine("    volumes:");
        sb.AppendLine($"      - {YamlString(dataPath + ":/data")}");
        return sb.ToString();
    }

    /// <summary>Encode an arbitrary value as a YAML double-quoted scalar.</summary>
    public static string YamlString(string? value)
    {
        var sb = new StringBuilder("\"");
        foreach (var character in value ?? "")
        {
            sb.Append(character switch
            {
                '\\' => "\\\\",
                '"' => "\\\"",
                '\n' => "\\n",
                '\r' => "\\r",
                '\t' => "\\t",
                _ when char.IsControl(character) => $"\\u{(int)character:x4}",
                _ => character.ToString(),
            });
        }
        return sb.Append('"').ToString();
    }

    public string WriteDockerCompose()
    {
        Directory.CreateDirectory(DataFolder);
        var path = Path.Combine(DataFolder, "docker-compose.yml");
        File.WriteAllText(path, ToDockerCompose());
        return path;
    }
}
