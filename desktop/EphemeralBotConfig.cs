using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;

namespace WorldDownloaderManager;

/// <summary>
/// Short-lived, delete-on-close bot configuration. The serialized buffer is zeroed immediately,
/// and every construction failure closes and removes any partially written plaintext file.
/// </summary>
internal sealed class EphemeralBotConfig : IDisposable
{
    private readonly object _gate = new();
    private Stream? _lease;

    private EphemeralBotConfig(string path, Stream lease)
    {
        Path = path;
        _lease = lease;
    }

    public string Path { get; }

    public static EphemeralBotConfig Create(
        IReadOnlyDictionary<string, object?> config,
        string? runtimeDirectory = null,
        Func<string, Stream>? streamFactory = null)
    {
        ArgumentNullException.ThrowIfNull(config);
        runtimeDirectory ??= System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "WorldDownloaderManager", "Runtime");
        Directory.CreateDirectory(runtimeDirectory);
        var path = System.IO.Path.Combine(runtimeDirectory, $"bot-{Guid.NewGuid():N}.json");
        Stream? lease = null;
        byte[]? bytes = null;
        try
        {
            lease = streamFactory?.Invoke(path) ?? new FileStream(
                path, FileMode.CreateNew, FileAccess.Write, FileShare.Read | FileShare.Delete,
                4096, FileOptions.DeleteOnClose | FileOptions.WriteThrough);
            bytes = JsonSerializer.SerializeToUtf8Bytes(config);
            lease.Write(bytes);
            lease.Flush();
            if (lease is FileStream fileStream) fileStream.Flush(flushToDisk: true);
            return new EphemeralBotConfig(path, lease);
        }
        catch
        {
            try { lease?.Dispose(); } catch { /* best-effort secret cleanup */ }
            TryDelete(path);
            throw;
        }
        finally
        {
            if (bytes is not null) CryptographicOperations.ZeroMemory(bytes);
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            try { _lease?.Dispose(); } catch { /* best-effort secret cleanup */ }
            _lease = null;
            TryDelete(Path);
        }
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { /* retried on process exit */ }
    }
}
