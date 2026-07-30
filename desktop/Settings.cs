using System;
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

    /// <summary>Remote Minecraft server to download from (hostname/IP, no port). Baked into the
    /// generated compose as MWD_SERVER so the container is preconfigured.</summary>
    public string Server { get; set; } = "";
    /// <summary>World output directory (relative to /data). Baked in as MWD_WORLD_OUTPUT_DIR.</summary>
    public string OutputDir { get; set; } = "world";
    /// <summary>Start downloading automatically when the container boots (MWD_AUTOSTART). Needs an
    /// account already signed in (it persists in /data) — Microsoft sign-in itself stays interactive.</summary>
    public bool AutoStart { get; set; } = false;
    public string Image { get; set; } = "ghcr.io/cafepromenade/minecraft-world-downloader-web:latest";
    public string ContainerName { get; set; } = "minecraft-world-downloader";
    public bool RequireLogin { get; set; } = false;
    public string Username { get; set; } = "admin";

    /// <summary>The console password is encrypted for the current Windows user before settings are
    /// written. The clear text value is never serialized or included in diagnostic output.</summary>
    [JsonIgnore]
    public string Password
    {
        get => Unprotect(EncryptedPassword);
        set => EncryptedPassword = Protect(value);
    }

    public string EncryptedPassword { get; set; } = "";

    // Persisted global-memory preferences. UI copy is localized from resources; language and humour
    // are independent so bilingual mode does not force both voices to use the same tone.
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

    /// <summary>Build the image locally from source instead of pulling the prebuilt one
    /// (useful offline, behind a firewall, or to run your own changes).</summary>
    public bool BuildLocally { get; set; } = false;
    /// <summary>Folder containing the Dockerfile to build from. Blank = auto-detect (running from the repo).</summary>
    public string BuildContext { get; set; } = "";

    /// <summary>Tag for the locally-built image (kept distinct from the GHCR :latest tag).</summary>
    public const string LocalImageTag = "minecraft-world-downloader-web:local";

    /// <summary>The image actually run: the locally-built tag when building locally, else the configured image.</summary>
    public string EffectiveImage => BuildLocally ? LocalImageTag : Image;

    private static string FilePath
    {
        get
        {
            var dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "WorldDownloaderManager");
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "settings.json");
        }
    }

    private static readonly byte[] PasswordEntropy = Encoding.UTF8.GetBytes(
        "WorldDownloaderManager.ConsolePassword.v1");

    private static string Protect(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        var clear = Encoding.UTF8.GetBytes(value);
        try
        {
            return Convert.ToBase64String(ProtectedData.Protect(
                clear, PasswordEntropy, DataProtectionScope.CurrentUser));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(clear);
        }
    }

    private static string Unprotect(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        byte[]? encrypted = null;
        byte[]? clear = null;
        try
        {
            encrypted = Convert.FromBase64String(value);
            clear = ProtectedData.Unprotect(encrypted, PasswordEntropy, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(clear);
        }
        catch (CryptographicException)
        {
            // A settings file copied from another Windows account cannot be decrypted. Treat the
            // password as absent and let the user enter it again instead of crashing at startup.
            return "";
        }
        catch (FormatException)
        {
            return "";
        }
        finally
        {
            if (encrypted is not null) CryptographicOperations.ZeroMemory(encrypted);
            if (clear is not null) CryptographicOperations.ZeroMemory(clear);
        }
    }

    public static Settings Load()
    {
        Settings s = new();
        try
        {
            if (File.Exists(FilePath))
            {
                var json = File.ReadAllText(FilePath);
                s = JsonSerializer.Deserialize<Settings>(json) ?? new Settings();

                // One-time migration from the legacy plaintext Password property. The next save
                // replaces it with EncryptedPassword; the value is never logged.
                if (string.IsNullOrWhiteSpace(s.EncryptedPassword))
                {
                    using var document = JsonDocument.Parse(json);
                    if (document.RootElement.TryGetProperty("Password", out var oldPassword) &&
                        oldPassword.ValueKind == JsonValueKind.String)
                    {
                        s.Password = oldPassword.GetString() ?? "";
                        s.Save();
                    }
                }
            }
        }
        catch { /* fall back to defaults */ }

        if (string.IsNullOrWhiteSpace(s.DataFolder))
        {
            s.DataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                "WorldDownloader");
        }

        // Migrate the legacy GHCR package name to the new "-web" package. The old package's ACL blocked
        // automated publishing, so its :latest is stale; point existing installs at the package that
        // actually receives updates.
        if (s.Image == "ghcr.io/cafepromenade/minecraft-world-downloader:latest")
            s.Image = "ghcr.io/cafepromenade/minecraft-world-downloader-web:latest";

        s.EnglishFunnyLevel = Math.Clamp(s.EnglishFunnyLevel, 1, 5);
        s.CantoneseFunnyLevel = Math.Clamp(s.CantoneseFunnyLevel, 1, 5);
        s.UiFontScale = Math.Clamp(s.UiFontScale, 0.75, 2.0);

        return s;
    }

    public void Save()
    {
        try
        {
            File.WriteAllText(FilePath,
                JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch { /* ignore */ }
    }

    /// <summary>Render a docker-compose.yml equivalent to the current settings.</summary>
    public string ToDockerCompose()
    {
        var dataPath = (DataFolder ?? "").Replace("\\", "/");
        var sb = new System.Text.StringBuilder();
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
            var ctx = (string.IsNullOrWhiteSpace(BuildContext) ? "." : BuildContext).Replace("\\", "/");
            sb.AppendLine($"    build: {YamlString(ctx)}   # build the image locally from this source folder (must contain the Dockerfile)");
            sb.AppendLine($"    image: {YamlString(LocalImageTag)}   # tag the locally-built image");
        }
        else
        {
            sb.AppendLine($"    image: {YamlString(Image)}");
            sb.AppendLine("    pull_policy: always   # always fetch the latest published image so the console stays current");
        }
        sb.AppendLine($"    container_name: {YamlString(ContainerName)}");
        sb.AppendLine("    restart: unless-stopped");
        sb.AppendLine("    ports:");
        sb.AppendLine($"      - \"{WebPort}:8080\"      # web console -> http://localhost:{WebPort}");
        sb.AppendLine($"      - \"{ProxyPort}:25565\"    # Minecraft proxy -> connect to localhost:{ProxyPort}");
        sb.AppendLine("    environment:");
        sb.AppendLine("      WEB_PORT: \"8080\"");
        if (RequireLogin)
        {
            sb.AppendLine($"      WEB_USERNAME: {YamlString(Username)}");
            sb.AppendLine($"      WEB_PASSWORD: {YamlString(Password)}");
        }
        // Downloader config baked in so the container is preconfigured (web/app.py reads MWD_* env vars).
        if (!string.IsNullOrWhiteSpace(Server))
            sb.AppendLine($"      MWD_SERVER: {YamlString(Server.Trim())}            # remote server to download from");
        if (!string.IsNullOrWhiteSpace(OutputDir) && OutputDir.Trim() != "world")
            sb.AppendLine($"      MWD_WORLD_OUTPUT_DIR: {YamlString(OutputDir.Trim())}   # world output dir (under /data)");
        if (AutoStart)
            sb.AppendLine("      MWD_AUTOSTART: \"true\"        # start downloading on boot (account must be signed in)");
        sb.AppendLine("    volumes:");
        sb.AppendLine($"      - {YamlString(dataPath + ":/data")}");
        return sb.ToString();
    }

    /// <summary>Encode an arbitrary value as a YAML double-quoted scalar. This prevents settings
    /// containing quotes, newlines, backslashes or control characters from changing YAML structure.</summary>
    public static string YamlString(string? value)
    {
        var sb = new StringBuilder("\"");
        foreach (var c in value ?? "")
        {
            sb.Append(c switch
            {
                '\\' => "\\\\",
                '"' => "\\\"",
                '\n' => "\\n",
                '\r' => "\\r",
                '\t' => "\\t",
                _ when char.IsControl(c) => $"\\u{(int)c:x4}",
                _ => c.ToString(),
            });
        }
        return sb.Append('"').ToString();
    }

    /// <summary>Write docker-compose.yml into the data folder; returns the file path.</summary>
    public string WriteDockerCompose()
    {
        Directory.CreateDirectory(DataFolder);
        var path = Path.Combine(DataFolder, "docker-compose.yml");
        File.WriteAllText(path, ToDockerCompose());
        return path;
    }
}
