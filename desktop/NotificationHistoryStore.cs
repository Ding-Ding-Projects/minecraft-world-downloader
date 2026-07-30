using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;

namespace WorldDownloaderManager;

/// <summary>
/// Persisted, display-safe notification metadata. Callers must pass already-redacted user-facing
/// copy; the store never logs notification content and action targets remain inert strings.
/// </summary>
public sealed record NotificationHistoryEntry(
    Guid Id,
    DateTimeOffset Timestamp,
    string Kind,
    string Title,
    string Body,
    string? ActionLabel = null,
    string? ActionTarget = null)
{
    public string DisplayText =>
        $"{Timestamp:yyyy-MM-dd HH:mm:ss zzz}  [{Kind.ToUpperInvariant()}]  {Title} — {Body}";
}

public sealed record NotificationHistoryLoadResult(
    IReadOnlyList<NotificationHistoryEntry> Items,
    string? Warning)
{
    public bool HasWarning => !string.IsNullOrWhiteSpace(Warning);
}

public sealed record NotificationHistoryMutationResult(
    bool Succeeded,
    IReadOnlyList<NotificationHistoryEntry> Items,
    NotificationHistoryEntry? ChangedEntry,
    string? Error);

/// <summary>
/// Thread-safe, process-safe persistence for the desktop notification centre. The newest 200
/// structured records are written atomically below the app-owned local data directory.
/// </summary>
public sealed class NotificationHistoryStore
{
    public const int MaximumEntries = 200;

    private const int SchemaVersion = 1;
    private static readonly TimeSpan DefaultLockTimeout = TimeSpan.FromSeconds(30);
    private static readonly UTF8Encoding Utf8WithoutBom = new(false);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
    };

    private readonly object _gate = new();
    private readonly string _filePath;
    private readonly TimeSpan _lockTimeout;
    private readonly string _mutexName;

    public NotificationHistoryStore()
        : this(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "WorldDownloaderManager",
            "notification-history.json"))
    {
    }

    /// <summary>Test-only path injection; the test assembly is granted internal visibility.</summary>
    internal NotificationHistoryStore(string filePath)
        : this(filePath, DefaultLockTimeout)
    {
    }

    /// <summary>Test-only path and lock-timeout injection.</summary>
    internal NotificationHistoryStore(string filePath, TimeSpan lockTimeout)
    {
        if (string.IsNullOrWhiteSpace(filePath))
            throw new ArgumentException("A notification-history path is required.", nameof(filePath));
        if (lockTimeout < TimeSpan.Zero || lockTimeout > TimeSpan.FromMilliseconds(int.MaxValue))
            throw new ArgumentOutOfRangeException(nameof(lockTimeout));
        _filePath = Path.GetFullPath(filePath);
        _lockTimeout = lockTimeout;
        _mutexName = BuildMutexName(_filePath);
    }

    public string FilePath => _filePath;
    internal string MutexName => _mutexName;

    public NotificationHistoryLoadResult Load()
    {
        using var access = TryAcquireExclusiveAccess();
        if (access is null)
        {
            return new NotificationHistoryLoadResult(
                Array.Empty<NotificationHistoryEntry>(),
                "Notification history could not be accessed. The existing file was left unchanged.");
        }
        return ReadFromDisk();
    }

    public NotificationHistoryLoadResult Snapshot() => Load();

    public NotificationHistoryMutationResult Add(
        string kind,
        string title,
        string body,
        string? actionLabel = null,
        string? actionTarget = null,
        DateTimeOffset? timestamp = null,
        Guid? id = null) => Add(new NotificationHistoryEntry(
            id ?? Guid.NewGuid(),
            timestamp ?? DateTimeOffset.Now,
            kind,
            title,
            body,
            actionLabel,
            actionTarget));

    public NotificationHistoryMutationResult Add(NotificationHistoryEntry entry)
    {
        ValidateEntry(entry);
        using var access = TryAcquireExclusiveAccess();
        if (access is null)
            return LockFailureMutation(entry);
        var loaded = ReadFromDisk();
        if (loaded.HasWarning)
        {
            return new NotificationHistoryMutationResult(
                false,
                loaded.Items,
                entry,
                "Notification history could not be updated because its existing file could not be read.");
        }

        var updated = Normalize(new[] { entry }
            .Concat(loaded.Items.Where(item => item.Id != entry.Id)));
        return WriteMutation(updated, entry);
    }

    public NotificationHistoryMutationResult Clear()
    {
        using var access = TryAcquireExclusiveAccess();
        if (access is null)
            return LockFailureMutation(null);
        return WriteMutation(Array.Empty<NotificationHistoryEntry>(), null);
    }

    /// <summary>
    /// Atomically replaces the current history with a supplied state snapshot. Stable identifiers
    /// and original timestamp offsets are retained, making this suitable for local-history restore.
    /// </summary>
    public NotificationHistoryMutationResult Replace(IEnumerable<NotificationHistoryEntry> snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        var materialized = snapshot.ToArray();
        foreach (var entry in materialized) ValidateEntry(entry);
        var normalized = Normalize(materialized);
        using var access = TryAcquireExclusiveAccess();
        if (access is null)
            return LockFailureMutation(null);
        return WriteMutation(normalized, null);
    }

    private static NotificationHistoryMutationResult LockFailureMutation(
        NotificationHistoryEntry? changedEntry) => new(
            false,
            Array.Empty<NotificationHistoryEntry>(),
            changedEntry,
            "Notification history could not be updated because exclusive access was unavailable. " +
            "The existing file was left unchanged.");

    private NotificationHistoryLoadResult ReadFromDisk()
    {
        if (!File.Exists(_filePath))
            return new NotificationHistoryLoadResult(Array.Empty<NotificationHistoryEntry>(), null);

        try
        {
            using var stream = new FileStream(
                _filePath, FileMode.Open, FileAccess.Read, FileShare.Read,
                bufferSize: 4096, FileOptions.SequentialScan);
            var document = JsonSerializer.Deserialize<NotificationHistoryDocument>(stream, JsonOptions)
                ?? throw new JsonException("Notification history document is empty.");
            if (document.SchemaVersion != SchemaVersion || document.Items is null)
                throw new JsonException("Notification history schema is unsupported.");
            foreach (var entry in document.Items) ValidateEntry(entry);
            return new NotificationHistoryLoadResult(Normalize(document.Items), null);
        }
        catch (Exception exception) when (exception is JsonException or ArgumentException or IOException or
                                          UnauthorizedAccessException or NotSupportedException)
        {
            // Never include exception or notification content in the warning. The original file is
            // deliberately left untouched so a later recovery path can inspect it.
            return new NotificationHistoryLoadResult(
                Array.Empty<NotificationHistoryEntry>(),
                "Notification history could not be read. The existing file was left unchanged.");
        }
    }

    private NotificationHistoryMutationResult WriteMutation(
        IReadOnlyList<NotificationHistoryEntry> items,
        NotificationHistoryEntry? changedEntry)
    {
        string? temporaryPath = null;
        try
        {
            var directory = Path.GetDirectoryName(_filePath)
                ?? throw new IOException("The notification-history directory is unavailable.");
            Directory.CreateDirectory(directory);
            temporaryPath = Path.Combine(
                directory,
                $".{Path.GetFileName(_filePath)}.{Guid.NewGuid():N}.tmp");
            var document = new NotificationHistoryDocument(SchemaVersion, items.ToArray());

            using (var stream = new FileStream(
                       temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                       bufferSize: 4096, FileOptions.WriteThrough))
            using (var writer = new StreamWriter(stream, Utf8WithoutBom))
            {
                writer.Write(JsonSerializer.Serialize(document, JsonOptions));
                writer.Flush();
                stream.Flush(flushToDisk: true);
            }

            File.Move(temporaryPath, _filePath, overwrite: true);
            temporaryPath = null;
            return new NotificationHistoryMutationResult(true, items, changedEntry, null);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or
                                          NotSupportedException or JsonException)
        {
            // Keep errors factual but content-free. MainWindow can surface this as a persistent toast.
            return new NotificationHistoryMutationResult(
                false,
                items,
                changedEntry,
                "Notification history could not be saved. The previous persisted history was left unchanged.");
        }
        finally
        {
            if (temporaryPath is not null)
            {
                try { File.Delete(temporaryPath); }
                catch { /* bounded best-effort cleanup; never log notification content */ }
            }
        }
    }

    private static IReadOnlyList<NotificationHistoryEntry> Normalize(
        IEnumerable<NotificationHistoryEntry> items)
    {
        var seen = new HashSet<Guid>();
        return items
            .Select((item, index) => (Item: item, Index: index))
            .OrderByDescending(candidate => candidate.Item.Timestamp)
            .ThenBy(candidate => candidate.Index)
            .Select(candidate => candidate.Item)
            .Where(item => seen.Add(item.Id))
            .Take(MaximumEntries)
            .ToArray();
    }

    private static void ValidateEntry(NotificationHistoryEntry entry)
    {
        ArgumentNullException.ThrowIfNull(entry);
        if (entry.Id == Guid.Empty) throw new ArgumentException("A stable notification id is required.", nameof(entry));
        if (string.IsNullOrWhiteSpace(entry.Kind)) throw new ArgumentException("A notification kind is required.", nameof(entry));
        if (string.IsNullOrWhiteSpace(entry.Title)) throw new ArgumentException("A notification title is required.", nameof(entry));
        if (entry.Body is null) throw new ArgumentException("A notification body is required.", nameof(entry));
        if (string.IsNullOrWhiteSpace(entry.ActionLabel) != string.IsNullOrWhiteSpace(entry.ActionTarget))
            throw new ArgumentException("Notification action label and target must be supplied together.", nameof(entry));
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
                acquired = processMutex.WaitOne(_lockTimeout);
            }
            catch (AbandonedMutexException)
            {
                acquired = true;
            }
            if (!acquired)
                throw new TimeoutException("Timed out waiting for another process to finish updating notification history.");
            return new ExclusiveAccess(_gate, processMutex);
        }
        catch
        {
            processMutex?.Dispose();
            Monitor.Exit(_gate);
            throw;
        }
    }

    private IDisposable? TryAcquireExclusiveAccess()
    {
        try
        {
            return AcquireExclusiveAccess();
        }
        catch (Exception exception) when (exception is TimeoutException or IOException or
                                          UnauthorizedAccessException or WaitHandleCannotBeOpenedException or
                                          PlatformNotSupportedException or System.Security.SecurityException)
        {
            // Lock failures are operational contention, not UI-fatal errors. Do not expose the
            // mutex name, path, exception text, or any notification content to callers.
            return null;
        }
    }

    private static string BuildMutexName(string filePath)
    {
        var normalized = Path.GetFullPath(filePath).ToUpperInvariant();
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return "WorldDownloaderManager.NotificationHistory." + Convert.ToHexString(digest);
    }

    private sealed record NotificationHistoryDocument(
        int SchemaVersion,
        NotificationHistoryEntry[] Items);

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
