using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using LibGit2Sharp;

namespace WorldDownloaderManager;

public sealed record HistoryRevision(
    string Sha,
    DateTimeOffset Timestamp,
    string Message,
    string? Label)
{
    public string ShortSha => Sha[..Math.Min(8, Sha.Length)];
    public string DisplayName => $"{Timestamp.LocalDateTime:g} · {Label ?? Message} · {ShortSha}";
}

public sealed record SettingsRestoreResult(
    HistoryRevision Revision,
    string SettingsJson,
    string RestoredFromSha);

internal enum HistoryPrunePhase
{
    AfterRebuildInitialized,
    BeforeRebuildValidation,
    BeforeSwap,
    AfterOriginalMoved,
    AfterReplacementMoved,
}

/// <summary>
/// Stores complete encrypted settings snapshots in an isolated, local-only Git repository. The
/// repository never lives inside a user's world/project folder and is never assigned a remote.
/// </summary>
public sealed class LocalHistoryService
{
    private const string SettingsFileName = "settings.json";
    private const string LabelsFileName = "labels.json";
    private const string RestoreTrailer = "Restore-From:";
    private static readonly TimeSpan LockTimeout = TimeSpan.FromSeconds(30);

    private readonly object _gate = new();
    private readonly string _repositoryPath;
    private readonly string _ownedRoot;
    private readonly string _mutexName;
    private readonly Func<DateTimeOffset> _clock;
    private readonly Action<HistoryPrunePhase>? _pruneTransition;

    private static readonly IReadOnlyDictionary<string, string> FriendlyNames =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["DataFolder"] = "data folder",
            ["WebPort"] = "web console port",
            ["ProxyPort"] = "Minecraft proxy port",
            ["ExposeWebToLan"] = "web console LAN exposure",
            ["Server"] = "Minecraft server",
            ["OutputDir"] = "world output directory",
            ["AutoStart"] = "automatic startup",
            ["Image"] = "Docker image",
            ["ContainerName"] = "container name",
            ["RequireLogin"] = "console login requirement",
            ["Username"] = "console username",
            ["EncryptedPassword"] = "console password",
            ["LanguageMode"] = "language mode",
            ["EnglishFunnyLevel"] = "English funny level",
            ["CantoneseFunnyLevel"] = "Cantonese funny level",
            ["DimSumSurpriseEnabled"] = "dim-sum startup delight",
            ["HasCompletedFirstRun"] = "first-run completion",
            ["Theme"] = "theme",
            ["LargeText"] = "large text",
            ["AccentColor"] = "accent colour",
            ["UiFontFamily"] = "UI font family",
            ["UiFontScale"] = "UI font scale",
            ["ExternalEditorPath"] = "external editor",
            ["BuildLocally"] = "local image build",
            ["BuildContext"] = "Docker build context",
            ["ServerJarPath"] = "BlueMap server jar",
            ["BlueMapThreads"] = "BlueMap thread count",
            ["BlueMapPort"] = "BlueMap port",
            ["BlueMapOverworld"] = "BlueMap overworld selection",
            ["BlueMapNether"] = "BlueMap nether selection",
            ["BlueMapEnd"] = "BlueMap End selection",
            ["BotAuth"] = "bot account type",
            ["BotUsername"] = "bot username",
            ["BotRadius"] = "bot radius",
            ["BotCount"] = "bot count",
            ["EncryptedBotLoginPassword"] = "bot login password",
            ["BotCenterOnSpawn"] = "bot spawn-centering",
            ["BotPreferFly"] = "bot flight preference",
            ["BotRevisit"] = "bot revisit preference",
        };

    private static readonly HashSet<string> ProtectedProperties = new(StringComparer.OrdinalIgnoreCase)
    {
        "EncryptedPassword",
        "EncryptedBotLoginPassword",
        "Password",
        "LoginPassword",
        "AccessToken",
        "RefreshToken",
        "SecretKey",
        "ApiKey",
        "Credential",
    };

    public LocalHistoryService()
        : this(DefaultRepositoryPath, DefaultOwnedRoot, null, null)
    {
    }

    /// <summary>Test-only path injection; the test assembly is granted internal visibility.</summary>
    internal LocalHistoryService(string repositoryPath)
        : this(repositoryPath, ParentOrRoot(repositoryPath), null, null)
    {
    }

    internal LocalHistoryService(
        string repositoryPath,
        string ownedRoot,
        Func<DateTimeOffset>? clock = null,
        Action<HistoryPrunePhase>? pruneTransition = null)
    {
        _repositoryPath = Path.GetFullPath(repositoryPath);
        _ownedRoot = Path.GetFullPath(ownedRoot);
        _clock = clock ?? (() => DateTimeOffset.Now);
        _pruneTransition = pruneTransition;
        _mutexName = BuildMutexName(_repositoryPath);
    }

    public string RepositoryPath => _repositoryPath;

    private static string DefaultOwnedRoot => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "WorldDownloaderManager");

    private static string DefaultRepositoryPath => Path.Combine(DefaultOwnedRoot, "History");

    public HistoryRevision? RecordSettingsSnapshot(string settingsJson, string? message = null)
    {
        using var access = AcquireExclusiveAccess();
        using var repository = OpenRepository();
        var normalized = NormalizeJson(settingsJson);
        var tip = repository.Head.Tip;
        if (tip is not null && JsonEquivalent(ReadFile(tip, SettingsFileName), normalized))
            return null;

        var previous = tip is null ? null : ReadFile(tip, SettingsFileName);
        var commitMessage = SanitizeMessage(message) ?? DescribeChanges(previous, normalized);
        var commit = CommitSettingsSnapshot(repository, normalized, commitMessage, allowEmpty: false);
        return ToRevision(commit, LoadLabels(repository));
    }

    /// <summary>
    /// Restores the selected settings tree into history as a new child commit. The returned JSON is
    /// what the UI coordinator should atomically apply to the live settings store. The commit is
    /// created even if the selected tree equals HEAD, so a restore is always visible and undoable.
    /// </summary>
    public SettingsRestoreResult RestoreSettingsSnapshot(string sha)
    {
        using var access = AcquireExclusiveAccess();
        using var repository = OpenRepository();
        var target = repository.Lookup<Commit>(sha)
            ?? throw new ArgumentException("Revision was not found.", nameof(sha));
        var snapshot = NormalizeJson(ReadFile(target, SettingsFileName)
            ?? throw new InvalidDataException("Revision has no settings snapshot."));
        var message = $"Restored application state from {target.Sha[..8]}\n\n{RestoreTrailer} {target.Sha}";
        var commit = CommitSettingsSnapshot(repository, snapshot, message, allowEmpty: true);
        return new SettingsRestoreResult(ToRevision(commit, LoadLabels(repository)), snapshot, target.Sha);
    }

    public IReadOnlyList<HistoryRevision> GetRevisions(int maximum = 500)
    {
        using var access = AcquireExclusiveAccess();
        using var repository = OpenRepository();
        var labels = LoadLabels(repository);
        return QuerySettingsRevisions(repository)
            .Take(Math.Clamp(maximum, 1, 5_000))
            .Select(commit => ToRevision(commit, labels))
            .ToArray();
    }

    public string GetSnapshot(string sha)
    {
        using var access = AcquireExclusiveAccess();
        using var repository = OpenRepository();
        return GetSnapshot(repository, sha);
    }

    public string DiffAgainst(string sha, string currentSettingsJson)
    {
        using var access = AcquireExclusiveAccess();
        using var repository = OpenRepository();
        return FormatJsonDiff(GetSnapshot(repository, sha), currentSettingsJson);
    }

    public HistoryRevision LabelRevision(string sha, string label)
    {
        var cleaned = SanitizeMessage(label);
        if (string.IsNullOrWhiteSpace(cleaned)) throw new ArgumentException("Enter a revision label.", nameof(label));

        using var access = AcquireExclusiveAccess();
        using var repository = OpenRepository();
        var target = repository.Lookup<Commit>(sha)
            ?? throw new ArgumentException("Revision was not found.", nameof(sha));
        if (!IsSettingsRevision(target))
            throw new ArgumentException("The selected commit is not a settings revision.", nameof(sha));

        var labels = LoadLabels(repository);
        if (labels.TryGetValue(target.Sha, out var existing) && existing == cleaned)
            return new HistoryRevision(target.Sha, target.Author.When, target.MessageShort, cleaned);

        labels[target.Sha] = cleaned;
        var labelsPath = Path.Combine(_repositoryPath, LabelsFileName);
        ValidateOwnedPath(labelsPath);
        try
        {
            File.WriteAllText(labelsPath,
                JsonSerializer.Serialize(labels, new JsonSerializerOptions { WriteIndented = true }),
                new UTF8Encoding(false));
            Commands.Stage(repository, LabelsFileName);
            var signature = Signature(_clock());
            repository.Commit($"Labeled revision {target.Sha[..8]} as {cleaned}", signature, signature);
        }
        catch
        {
            RestoreWorkingTree(repository);
            throw;
        }
        return new HistoryRevision(target.Sha, target.Author.When, target.MessageShort, cleaned);
    }

    public void ExportSnapshot(string sha, string destinationPath)
    {
        var snapshot = GetSnapshot(sha);
        File.WriteAllText(destinationPath, snapshot, new UTF8Encoding(false));
    }

    public void ExportRepository(string destinationZip)
    {
        using var access = AcquireExclusiveAccess();
        using var repository = OpenRepository();
        var destination = Path.GetFullPath(destinationZip);
        if (IsWithinOrEqual(_repositoryPath, destination))
            throw new InvalidOperationException("History exports must be written outside the history repository.");
        if (File.Exists(destination)) File.Delete(destination);
        ZipFile.CreateFromDirectory(_repositoryPath, destination, CompressionLevel.Optimal, false);
    }

    /// <summary>
    /// Explicitly rebuilds the isolated history to retain the newest N settings revisions. The
    /// replacement is fully validated before and after the swap. If any transition fails, the
    /// original repository is restored and the failed replacement is removed when safe.
    /// </summary>
    public int PruneToLatest(int keep)
    {
        keep = Math.Clamp(keep, 1, 5_000);
        using var access = AcquireExclusiveAccess();

        RetainedRevision[] allChronological;
        string originalHeadSha;
        using (var repository = OpenRepository())
        {
            var labels = LoadLabels(repository);
            var newestFirst = QuerySettingsRevisions(repository).ToArray();
            if (newestFirst.Length <= keep) return 0;
            originalHeadSha = repository.Head.Tip?.Sha
                ?? throw new InvalidDataException("History has revisions but no branch tip.");
            allChronological = newestFirst.AsEnumerable().Reverse()
                .Select(commit => new RetainedRevision(
                    commit.Sha,
                    commit.Author.When,
                    commit.Message,
                    ReadFile(commit, SettingsFileName)
                        ?? throw new InvalidDataException("Revision has no settings snapshot."),
                    labels.GetValueOrDefault(commit.Sha)))
                .ToArray();
        }

        var retained = allChronological[^keep..];
        var parent = Directory.GetParent(_repositoryPath)?.FullName
            ?? throw new InvalidOperationException("History directory has no parent.");
        var suffix = Guid.NewGuid().ToString("N");
        var temp = Path.Combine(parent, "History.rebuild-" + suffix);
        var backup = Path.Combine(parent, "History.backup-" + suffix);
        var failedReplacement = Path.Combine(parent, "History.failed-" + suffix);
        ValidateOwnedPath(temp);
        ValidateOwnedPath(backup);
        ValidateOwnedPath(failedReplacement);

        var originalMoved = false;
        var replacementMoved = false;
        var pruneSucceeded = false;
        var rollbackSucceeded = false;
        try
        {
            BuildPrunedRepository(temp, retained);
            _pruneTransition?.Invoke(HistoryPrunePhase.BeforeRebuildValidation);
            ValidateRebuiltRepository(temp, retained);

            try
            {
                _pruneTransition?.Invoke(HistoryPrunePhase.BeforeSwap);
                Directory.Move(_repositoryPath, backup);
                originalMoved = true;
                _pruneTransition?.Invoke(HistoryPrunePhase.AfterOriginalMoved);
                Directory.Move(temp, _repositoryPath);
                replacementMoved = true;
                _pruneTransition?.Invoke(HistoryPrunePhase.AfterReplacementMoved);
                ValidateRebuiltRepository(_repositoryPath, retained);
                pruneSucceeded = true;
            }
            catch (Exception pruneFailure)
            {
                try
                {
                    if (replacementMoved && Directory.Exists(_repositoryPath))
                        Directory.Move(_repositoryPath, failedReplacement);
                    if (originalMoved && Directory.Exists(backup))
                        Directory.Move(backup, _repositoryPath);
                    ValidateRepositoryHead(_repositoryPath, originalHeadSha);
                    rollbackSucceeded = true;
                }
                catch (Exception rollbackFailure)
                {
                    throw new AggregateException(
                        "History pruning failed and the original repository could not be restored automatically. " +
                        $"Recovery data was retained at '{backup}'.",
                        pruneFailure,
                        rollbackFailure);
                }
                throw;
            }
        }
        finally
        {
            if (pruneSucceeded) TryDeleteDirectory(backup);
            TryDeleteDirectory(temp);
            if (rollbackSucceeded) TryDeleteDirectory(failedReplacement);
        }
        return allChronological.Length - keep;
    }

    public static string DescribeChanges(string? previousJson, string currentJson)
    {
        if (string.IsNullOrWhiteSpace(previousJson)) return "Created initial application state";
        var changes = ChangedProperties(previousJson, currentJson)
            .Select(name => FriendlyNames.TryGetValue(name, out var friendly) ? friendly : name)
            .Take(4)
            .ToArray();
        return changes.Length switch
        {
            0 => "Recorded application state",
            1 => "Changed " + changes[0],
            _ => "Changed " + string.Join(", ", changes[..^1]) + " and " + changes[^1],
        };
    }

    public static string FormatJsonDiff(string oldJson, string newJson)
    {
        var oldValues = Properties(oldJson);
        var newValues = Properties(newJson);
        var changed = oldValues.Keys.Union(newValues.Keys, StringComparer.Ordinal)
            .Where(key => !JsonValueEquals(oldValues.GetValueOrDefault(key), newValues.GetValueOrDefault(key)))
            .OrderBy(key => key, StringComparer.Ordinal)
            .ToArray();
        if (changed.Length == 0) return "No differences from the current settings.";

        var output = new StringBuilder();
        foreach (var key in changed)
        {
            var name = FriendlyNames.TryGetValue(key, out var friendly) ? friendly : key;
            output.AppendLine(name + ":");
            if (IsProtectedProperty(key))
            {
                output.AppendLine("  protected value changed");
                continue;
            }
            output.AppendLine("  revision: " + DisplayValue(oldValues.GetValueOrDefault(key)));
            output.AppendLine("  current:  " + DisplayValue(newValues.GetValueOrDefault(key)));
        }
        return output.ToString();
    }

    private Commit CommitSettingsSnapshot(Repository repository, string normalized, string message, bool allowEmpty)
    {
        var settingsPath = Path.Combine(_repositoryPath, SettingsFileName);
        ValidateOwnedPath(settingsPath);
        try
        {
            File.WriteAllText(settingsPath, normalized, new UTF8Encoding(false));
            Commands.Stage(repository, SettingsFileName);
            var signature = Signature(_clock());
            return repository.Commit(message, signature, signature,
                new CommitOptions { AllowEmptyCommit = allowEmpty });
        }
        catch
        {
            RestoreWorkingTree(repository);
            throw;
        }
    }

    private void BuildPrunedRepository(string path, IReadOnlyList<RetainedRevision> retained)
    {
        Repository.Init(path);
        _pruneTransition?.Invoke(HistoryPrunePhase.AfterRebuildInitialized);
        using var rebuilt = new Repository(path);
        var oldToNew = new Dictionary<string, string>(StringComparer.Ordinal);
        var labels = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var item in retained)
        {
            File.WriteAllText(Path.Combine(path, SettingsFileName), item.Snapshot, new UTF8Encoding(false));
            Commands.Stage(rebuilt, SettingsFileName);
            var message = RemapRestoreMetadata(item.Message, oldToNew);
            var signature = Signature(item.Timestamp);
            var commit = rebuilt.Commit(message, signature, signature,
                new CommitOptions { AllowEmptyCommit = true });
            oldToNew[item.OldSha] = commit.Sha;
            if (!string.IsNullOrWhiteSpace(item.Label)) labels[commit.Sha] = item.Label;
        }
        if (labels.Count == 0) return;

        File.WriteAllText(Path.Combine(path, LabelsFileName),
            JsonSerializer.Serialize(labels, new JsonSerializerOptions { WriteIndented = true }),
            new UTF8Encoding(false));
        Commands.Stage(rebuilt, LabelsFileName);
        var labelSignature = Signature(_clock());
        rebuilt.Commit("Preserved revision labels after pruning", labelSignature, labelSignature);
    }

    private void ValidateRebuiltRepository(string path, IReadOnlyList<RetainedRevision> expectedChronological)
    {
        ValidateOwnedPath(path);
        using var repository = new Repository(path);
        EnsureNoRemote(repository);
        if (repository.RetrieveStatus().IsDirty)
            throw new InvalidDataException("Rebuilt history has uncommitted files.");

        var actualNewest = QuerySettingsRevisions(repository).ToArray();
        if (actualNewest.Length != expectedChronological.Count)
            throw new InvalidDataException("Rebuilt history has the wrong revision count.");
        var labels = LoadLabels(repository);
        for (var i = 0; i < actualNewest.Length; i++)
        {
            var expected = expectedChronological[expectedChronological.Count - 1 - i];
            var actual = actualNewest[i];
            if (!JsonEquivalent(ReadFile(actual, SettingsFileName), expected.Snapshot))
                throw new InvalidDataException("Rebuilt history changed a retained snapshot.");
            var actualLabel = labels.GetValueOrDefault(actual.Sha);
            if (!string.Equals(actualLabel, expected.Label, StringComparison.Ordinal))
                throw new InvalidDataException("Rebuilt history changed a retained label.");
        }
    }

    private void ValidateRepositoryHead(string path, string expectedHeadSha)
    {
        ValidateOwnedPath(path);
        using var repository = new Repository(path);
        EnsureNoRemote(repository);
        if (!string.Equals(repository.Head.Tip?.Sha, expectedHeadSha, StringComparison.Ordinal))
            throw new InvalidDataException("The restored history does not match the original repository.");
    }

    private Repository OpenRepository()
    {
        ValidateOwnedPath(_repositoryPath);
        Directory.CreateDirectory(_repositoryPath);
        ValidateOwnedPath(_repositoryPath);
        if (!Repository.IsValid(_repositoryPath)) Repository.Init(_repositoryPath);

        var gitDirectory = Path.Combine(_repositoryPath, ".git");
        if (File.Exists(gitDirectory) && !Directory.Exists(gitDirectory))
            throw new InvalidOperationException("History metadata must not redirect to another Git directory.");
        ValidateOwnedPath(gitDirectory);

        var repository = new Repository(_repositoryPath);
        try
        {
            EnsureNoRemote(repository);
            return repository;
        }
        catch
        {
            repository.Dispose();
            throw;
        }
    }

    private static void EnsureNoRemote(Repository repository)
    {
        if (repository.Network.Remotes.Any())
            throw new InvalidOperationException("Local history must not have a remote.");
    }

    private void ValidateOwnedPath(string path)
    {
        var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(_ownedRoot));
        var candidate = Path.GetFullPath(path);
        if (!IsWithinOrEqual(root, candidate))
            throw new InvalidOperationException("History path is outside the app-owned data directory.");

        RejectReparsePoint(root);
        var relative = Path.GetRelativePath(root, candidate);
        if (relative == ".") return;
        var current = root;
        foreach (var segment in relative.Split(
                     new[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar },
                     StringSplitOptions.RemoveEmptyEntries))
        {
            current = Path.Combine(current, segment);
            RejectReparsePoint(current);
        }
    }

    private static bool IsWithinOrEqual(string root, string candidate)
    {
        root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root));
        candidate = Path.GetFullPath(candidate);
        var comparison = OperatingSystem.IsWindows()
            ? StringComparison.OrdinalIgnoreCase
            : StringComparison.Ordinal;
        return candidate.Equals(root, comparison) ||
               candidate.StartsWith(root + Path.DirectorySeparatorChar, comparison);
    }

    private static void RejectReparsePoint(string path)
    {
        if (!Directory.Exists(path) && !File.Exists(path)) return;
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidOperationException("History paths must not contain symbolic links or reparse points.");
    }

    private IDisposable AcquireExclusiveAccess()
    {
        Monitor.Enter(_gate);
        Mutex? processMutex = null;
        try
        {
            processMutex = new Mutex(false, _mutexName);
            bool acquired;
            try
            {
                acquired = processMutex.WaitOne(LockTimeout);
            }
            catch (AbandonedMutexException)
            {
                acquired = true;
            }
            if (!acquired)
                throw new TimeoutException("Timed out waiting for another World Downloader Manager process to finish updating history.");
            return new ExclusiveAccess(_gate, processMutex);
        }
        catch
        {
            processMutex?.Dispose();
            Monitor.Exit(_gate);
            throw;
        }
    }

    private static string BuildMutexName(string repositoryPath)
    {
        var normalized = Path.GetFullPath(repositoryPath).ToUpperInvariant();
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return "WorldDownloaderManager.History." + Convert.ToHexString(digest);
    }

    private static string ParentOrRoot(string path)
    {
        var fullPath = Path.GetFullPath(path);
        return Directory.GetParent(fullPath)?.FullName
               ?? Path.GetPathRoot(fullPath)
               ?? throw new InvalidOperationException("History path has no filesystem root.");
    }

    private static Signature Signature(DateTimeOffset when) =>
        new("World Downloader Manager", "local-history@world-downloader.invalid", when);

    private static IEnumerable<Commit> QuerySettingsRevisions(Repository repository)
    {
        if (repository.Head.Tip is null) return Enumerable.Empty<Commit>();
        return repository.Commits.QueryBy(new CommitFilter
        {
            IncludeReachableFrom = repository.Head,
            SortBy = CommitSortStrategies.Topological | CommitSortStrategies.Time,
        }).Where(IsSettingsRevision);
    }

    private static bool IsSettingsRevision(Commit commit)
    {
        if (HasRestoreTrailer(commit.Message)) return true;
        var current = commit[SettingsFileName]?.Target?.Id;
        if (current is null) return false;
        var parent = commit.Parents.FirstOrDefault();
        return parent is null || parent[SettingsFileName]?.Target?.Id != current;
    }

    private static bool HasRestoreTrailer(string message) => message
        .Split(new[] { "\r\n", "\n" }, StringSplitOptions.None)
        .Any(line => line.StartsWith(RestoreTrailer + " ", StringComparison.Ordinal));

    private static HistoryRevision ToRevision(Commit commit, IReadOnlyDictionary<string, string> labels) =>
        new(commit.Sha, commit.Author.When, commit.MessageShort,
            labels.TryGetValue(commit.Sha, out var label) ? label : null);

    private static Dictionary<string, string> LoadLabels(Repository repository)
    {
        var text = repository.Head.Tip is null ? null : ReadFile(repository.Head.Tip, LabelsFileName);
        try { return text is null ? new() : JsonSerializer.Deserialize<Dictionary<string, string>>(text) ?? new(); }
        catch (JsonException) { return new(); }
    }

    private static string GetSnapshot(Repository repository, string sha)
    {
        var commit = repository.Lookup<Commit>(sha)
            ?? throw new ArgumentException("Revision was not found.", nameof(sha));
        return ReadFile(commit, SettingsFileName)
               ?? throw new InvalidDataException("Revision has no settings snapshot.");
    }

    private static string? ReadFile(Commit commit, string path)
    {
        if (commit[path]?.Target is not Blob blob) return null;
        using var content = new StreamReader(blob.GetContentStream(), Encoding.UTF8, true);
        return content.ReadToEnd();
    }

    private static string NormalizeJson(string json)
    {
        var node = JsonNode.Parse(json) ?? throw new JsonException("Settings snapshot is empty.");
        return node.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
    }

    private static bool JsonEquivalent(string? left, string right)
    {
        if (left is null) return false;
        return JsonNode.DeepEquals(JsonNode.Parse(left), JsonNode.Parse(right));
    }

    private static IReadOnlyDictionary<string, JsonElement?> Properties(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.EnumerateObject()
            .ToDictionary(property => property.Name, property => (JsonElement?)property.Value.Clone(), StringComparer.Ordinal);
    }

    private static IEnumerable<string> ChangedProperties(string oldJson, string newJson)
    {
        var oldValues = Properties(oldJson);
        var newValues = Properties(newJson);
        return oldValues.Keys.Union(newValues.Keys, StringComparer.Ordinal)
            .Where(key => !JsonValueEquals(oldValues.GetValueOrDefault(key), newValues.GetValueOrDefault(key)));
    }

    private static bool JsonValueEquals(JsonElement? left, JsonElement? right) =>
        left?.GetRawText() == right?.GetRawText();

    private static bool IsProtectedProperty(string key)
    {
        if (ProtectedProperties.Contains(key)) return true;
        var compact = new string(key.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        return compact.Contains("password", StringComparison.Ordinal) ||
               compact.Contains("token", StringComparison.Ordinal) ||
               compact.Contains("secret", StringComparison.Ordinal) ||
               compact.Contains("credential", StringComparison.Ordinal) ||
               compact.Contains("apikey", StringComparison.Ordinal) ||
               compact.Contains("privatekey", StringComparison.Ordinal) ||
               compact.Contains("encryptionkey", StringComparison.Ordinal) ||
               compact.Contains("accesskey", StringComparison.Ordinal);
    }

    private static string DisplayValue(JsonElement? value) => value is null ? "<not set>" : value.Value.ValueKind switch
    {
        JsonValueKind.String => value.Value.GetString() ?? "",
        _ => value.Value.GetRawText(),
    };

    private static string? SanitizeMessage(string? message)
    {
        if (string.IsNullOrWhiteSpace(message)) return null;
        var characters = message.Select(character => char.IsControl(character) ? ' ' : character).ToArray();
        var cleaned = string.Join(" ", new string(characters)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return cleaned.Length <= 240 ? cleaned : cleaned[..240];
    }

    private static string RemapRestoreMetadata(string message, IReadOnlyDictionary<string, string> oldToNew)
    {
        var newline = message.Contains("\r\n", StringComparison.Ordinal) ? "\r\n" : "\n";
        var lines = message.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
        for (var index = 0; index < lines.Length; index++)
        {
            if (!lines[index].StartsWith(RestoreTrailer + " ", StringComparison.Ordinal)) continue;
            var oldSha = lines[index][(RestoreTrailer.Length + 1)..].Trim();
            if (oldToNew.TryGetValue(oldSha, out var newSha))
                lines[index] = RestoreTrailer + " " + newSha;
        }
        return string.Join(newline, lines);
    }

    private static void RestoreWorkingTree(Repository repository)
    {
        try
        {
            if (repository.Head.Tip is not null)
            {
                repository.Reset(ResetMode.Hard, repository.Head.Tip);
                return;
            }
            try { Commands.Unstage(repository, new[] { SettingsFileName, LabelsFileName }); } catch { /* unborn branch */ }
            var settings = Path.Combine(repository.Info.WorkingDirectory, SettingsFileName);
            var labels = Path.Combine(repository.Info.WorkingDirectory, LabelsFileName);
            if (File.Exists(settings)) File.Delete(settings);
            if (File.Exists(labels)) File.Delete(labels);
        }
        catch
        {
            // Preserve the original exception. A later open will surface any repository damage.
        }
    }

    private static void TryDeleteDirectory(string path)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            try
            {
                DeleteFileSystemEntryWithoutFollowingReparsePoints(path, requireDirectory: true);
                return;
            }
            catch (Exception exception) when (exception is FileNotFoundException or DirectoryNotFoundException)
            {
                return;
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
                // libgit2/virus scanners can briefly retain a handle after repository disposal.
                // Retry for a bounded interval; if it remains locked, retain it for recovery.
                Thread.Sleep(20 * (attempt + 1));
            }
        }
    }

    private static void DeleteFileSystemEntryWithoutFollowingReparsePoints(
        string path,
        bool requireDirectory = false)
    {
        var attributes = File.GetAttributes(path);
        var isDirectory = (attributes & FileAttributes.Directory) != 0;
        var isReparsePoint = (attributes & FileAttributes.ReparsePoint) != 0;

        if (requireDirectory && !isDirectory)
            throw new IOException("The history cleanup target is not a directory.");

        // Delete a link or junction as a leaf. Never enumerate it, because recursive filesystem
        // enumeration follows directory reparse points and could escape the app-owned history tree.
        if (isReparsePoint)
        {
            if (isDirectory) Directory.Delete(path, recursive: false);
            else File.Delete(path);
            return;
        }

        if (!isDirectory)
        {
            File.SetAttributes(path, FileAttributes.Normal);
            File.Delete(path);
            return;
        }

        foreach (var entry in Directory.EnumerateFileSystemEntries(
                     path, "*", SearchOption.TopDirectoryOnly))
            DeleteFileSystemEntryWithoutFollowingReparsePoints(entry);

        // Clear read-only/system attributes only after every child has been removed. This path was
        // re-checked by the recursive call itself and is known not to be a reparse point.
        File.SetAttributes(path, FileAttributes.Directory);
        Directory.Delete(path, recursive: false);
    }

    private sealed record RetainedRevision(
        string OldSha,
        DateTimeOffset Timestamp,
        string Message,
        string Snapshot,
        string? Label);

    private sealed class ExclusiveAccess : IDisposable
    {
        private object? _gate;
        private Mutex? _mutex;

        public ExclusiveAccess(object gate, Mutex mutex)
        {
            _gate = gate;
            _mutex = mutex;
        }

        public void Dispose()
        {
            var mutex = Interlocked.Exchange(ref _mutex, null);
            var gate = Interlocked.Exchange(ref _gate, null);
            try
            {
                mutex?.ReleaseMutex();
            }
            finally
            {
                mutex?.Dispose();
                if (gate is not null) Monitor.Exit(gate);
            }
        }
    }
}
