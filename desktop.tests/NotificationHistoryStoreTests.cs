using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WorldDownloaderManager;
using Xunit;

namespace WorldDownloaderManager.Tests;

public sealed class NotificationHistoryStoreTests
{
    [Fact]
    public void RoundTripPreservesStableIdOffsetAndActionMetadata()
    {
        using var sandbox = new NotificationStoreSandbox();
        var path = Path.Combine(sandbox.Path, "notification-history.json");
        var store = new NotificationHistoryStore(path);
        var entry = new NotificationHistoryEntry(
            Guid.Parse("038675a5-1a49-42aa-a92e-adf886c0192f"),
            new DateTimeOffset(2026, 7, 29, 21, 15, 30, TimeSpan.FromHours(-4)),
            "warning",
            "Docker needs attention",
            "Docker Desktop is not running.",
            "Open settings",
            "open-settings");

        var added = store.Add(entry);
        var loaded = new NotificationHistoryStore(path).Load();

        Assert.True(added.Succeeded);
        Assert.False(loaded.HasWarning);
        Assert.Equal(entry, Assert.Single(loaded.Items));
        Assert.Equal(TimeSpan.FromHours(-4), loaded.Items[0].Timestamp.Offset);
    }

    [Fact]
    public void ReplaceOrdersNewestFirstDeduplicatesAndCapsAtTwoHundred()
    {
        using var sandbox = new NotificationStoreSandbox();
        var store = new NotificationHistoryStore(Path.Combine(sandbox.Path, "notification-history.json"));
        var origin = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var entries = Enumerable.Range(0, 205)
            .Select(index => Entry(index, origin.AddMinutes(index)))
            .Reverse()
            .Append(Entry(204, origin.AddMinutes(204)))
            .ToArray();

        var replaced = store.Replace(entries);

        Assert.True(replaced.Succeeded);
        Assert.Equal(NotificationHistoryStore.MaximumEntries, replaced.Items.Count);
        Assert.Equal("Title 204", replaced.Items[0].Title);
        Assert.Equal("Title 5", replaced.Items[^1].Title);
        Assert.Equal(200, replaced.Items.Select(item => item.Id).Distinct().Count());
    }

    [Fact]
    public void ClearPersistsAnEmptySnapshot()
    {
        using var sandbox = new NotificationStoreSandbox();
        var path = Path.Combine(sandbox.Path, "notification-history.json");
        var store = new NotificationHistoryStore(path);
        Assert.True(store.Add(Entry(1, DateTimeOffset.Now)).Succeeded);

        var cleared = store.Clear();

        Assert.True(cleared.Succeeded);
        Assert.Empty(cleared.Items);
        Assert.Empty(new NotificationHistoryStore(path).Snapshot().Items);
        Assert.True(File.Exists(path));
    }

    [Fact]
    public void CorruptLoadReturnsWarningLeavesFileAndBlocksOrdinaryAdd()
    {
        using var sandbox = new NotificationStoreSandbox();
        var path = Path.Combine(sandbox.Path, "notification-history.json");
        const string corrupt = "{ this is not valid json and must remain available for recovery";
        File.WriteAllText(path, corrupt);
        var store = new NotificationHistoryStore(path);

        var loaded = store.Load();
        var add = store.Add(Entry(1, DateTimeOffset.Now));

        Assert.True(loaded.HasWarning);
        Assert.Empty(loaded.Items);
        Assert.False(add.Succeeded);
        Assert.NotNull(add.Error);
        Assert.Equal(corrupt, File.ReadAllText(path));
    }

    [Fact]
    public void StructurallyInvalidEntryAlsoReturnsWarningInsteadOfThrowing()
    {
        using var sandbox = new NotificationStoreSandbox();
        var path = Path.Combine(sandbox.Path, "notification-history.json");
        File.WriteAllText(path,
            """
            {
              "SchemaVersion": 1,
              "Items": [
                {
                  "Id": "00000000-0000-0000-0000-000000000000",
                  "Timestamp": "2026-07-29T20:00:00-04:00",
                  "Kind": "warning",
                  "Title": "Invalid identity",
                  "Body": "This structurally invalid entry must not crash loading."
                }
              ]
            }
            """);

        var result = new NotificationHistoryStore(path).Load();

        Assert.True(result.HasWarning);
        Assert.Empty(result.Items);
    }

    [Fact]
    public void HeldCrossProcessMutexMakesLoadReturnContentFreeWarningWithoutChangingValidFile()
    {
        using var sandbox = new NotificationStoreSandbox();
        var path = Path.Combine(sandbox.Path, "notification-history.json");
        var existing = new NotificationHistoryEntry(
            EntryId(1),
            DateTimeOffset.UtcNow,
            "warning",
            "Existing private notification title",
            "Existing private notification body");
        Assert.True(new NotificationHistoryStore(path).Add(existing).Succeeded);
        var originalBytes = File.ReadAllBytes(path);
        var contendedStore = new NotificationHistoryStore(path, TimeSpan.FromMilliseconds(50));

        NotificationHistoryLoadResult result;
        using (new HeldNamedMutex(contendedStore.MutexName))
            result = contendedStore.Load();

        Assert.True(result.HasWarning);
        Assert.Empty(result.Items);
        Assert.Equal(
            "Notification history could not be accessed. The existing file was left unchanged.",
            result.Warning);
        Assert.False(result.Warning!.Contains(existing.Title, StringComparison.Ordinal));
        Assert.False(result.Warning.Contains(existing.Body, StringComparison.Ordinal));
        Assert.False(result.Warning.Contains(path, StringComparison.OrdinalIgnoreCase));
        Assert.False(result.Warning.Contains(contendedStore.MutexName, StringComparison.Ordinal));
        Assert.Equal(originalBytes, File.ReadAllBytes(path));
        Assert.Equal(existing, Assert.Single(new NotificationHistoryStore(path).Load().Items));
    }

    [Fact]
    public void HeldCrossProcessMutexMakesEveryMutationFailWithoutChangingValidFile()
    {
        using var sandbox = new NotificationStoreSandbox();
        var path = Path.Combine(sandbox.Path, "notification-history.json");
        var existing = Entry(1, DateTimeOffset.UtcNow.AddMinutes(-1));
        Assert.True(new NotificationHistoryStore(path).Add(existing).Succeeded);
        var originalBytes = File.ReadAllBytes(path);
        var contendedStore = new NotificationHistoryStore(path, TimeSpan.FromMilliseconds(50));
        var pendingAdd = new NotificationHistoryEntry(
            EntryId(2),
            DateTimeOffset.UtcNow,
            "error",
            "Pending private notification title",
            "Pending private notification body");
        var replacement = Entry(3, DateTimeOffset.UtcNow.AddMinutes(1));

        NotificationHistoryMutationResult add;
        NotificationHistoryMutationResult clear;
        NotificationHistoryMutationResult replace;
        using (new HeldNamedMutex(contendedStore.MutexName))
        {
            add = contendedStore.Add(pendingAdd);
            clear = contendedStore.Clear();
            replace = contendedStore.Replace(new[] { replacement });
        }

        const string expectedError =
            "Notification history could not be updated because exclusive access was unavailable. " +
            "The existing file was left unchanged.";
        foreach (var result in new[] { add, clear, replace })
        {
            Assert.False(result.Succeeded);
            Assert.Empty(result.Items);
            Assert.Equal(expectedError, result.Error);
            Assert.False(result.Error!.Contains(existing.Title, StringComparison.Ordinal));
            Assert.False(result.Error.Contains(existing.Body, StringComparison.Ordinal));
            Assert.False(result.Error.Contains(pendingAdd.Title, StringComparison.Ordinal));
            Assert.False(result.Error.Contains(pendingAdd.Body, StringComparison.Ordinal));
            Assert.False(result.Error.Contains(replacement.Title, StringComparison.Ordinal));
            Assert.False(result.Error.Contains(replacement.Body, StringComparison.Ordinal));
            Assert.False(result.Error.Contains(path, StringComparison.OrdinalIgnoreCase));
            Assert.False(result.Error.Contains(contendedStore.MutexName, StringComparison.Ordinal));
        }
        Assert.Equal(pendingAdd, add.ChangedEntry);
        Assert.Null(clear.ChangedEntry);
        Assert.Null(replace.ChangedEntry);
        Assert.Equal(originalBytes, File.ReadAllBytes(path));
        Assert.Empty(Directory.EnumerateFiles(sandbox.Path, ".*.tmp"));
        Assert.Equal(existing, Assert.Single(new NotificationHistoryStore(path).Load().Items));
    }

    [Fact]
    public void FailedAtomicMoveRemovesTemporaryFileAndReportsContentFreeError()
    {
        using var sandbox = new NotificationStoreSandbox();
        var destinationDirectory = Path.Combine(sandbox.Path, "notification-history.json");
        Directory.CreateDirectory(destinationDirectory);
        var store = new NotificationHistoryStore(destinationDirectory);

        var result = store.Add(Entry(1, DateTimeOffset.Now));

        Assert.False(result.Succeeded);
        Assert.Equal(
            "Notification history could not be saved. The previous persisted history was left unchanged.",
            result.Error);
        Assert.Empty(Directory.EnumerateFiles(sandbox.Path, "*.tmp"));
        Assert.Empty(Directory.EnumerateFiles(sandbox.Path, ".*.tmp"));
    }

    [Fact]
    public void UnicodeAndBilingualTextRoundTripsWithoutLoss()
    {
        using var sandbox = new NotificationStoreSandbox();
        var store = new NotificationHistoryStore(Path.Combine(sandbox.Path, "notification-history.json"));
        var entry = new NotificationHistoryEntry(
            Guid.NewGuid(),
            DateTimeOffset.Now,
            "info",
            "World saved · 世界已儲存 🧭",
            "The downloader kept every chunk.\n下載器一粒方塊都冇漏。",
            "Open folder · 開啟資料夾",
            "open-data-folder");

        Assert.True(store.Add(entry).Succeeded);

        Assert.Equal(entry, Assert.Single(store.Load().Items));
    }

    [Fact]
    public async Task IndependentInstancesMergeSequentialAndConcurrentAdds()
    {
        using var sandbox = new NotificationStoreSandbox();
        var path = Path.Combine(sandbox.Path, "notification-history.json");
        var first = new NotificationHistoryStore(path);
        var second = new NotificationHistoryStore(path);
        Assert.True(first.Add(Entry(1, DateTimeOffset.UtcNow.AddMinutes(-2))).Succeeded);
        Assert.True(second.Add(Entry(2, DateTimeOffset.UtcNow.AddMinutes(-1))).Succeeded);
        Assert.Equal(2, first.Snapshot().Items.Count);

        var writers = Enumerable.Range(3, 8)
            .Select(index => Task.Run(() =>
                new NotificationHistoryStore(path).Add(Entry(index, DateTimeOffset.UtcNow.AddMinutes(index)))))
            .ToArray();
        var results = await Task.WhenAll(writers);

        Assert.All(results, result => Assert.True(result.Succeeded, result.Error));
        var ids = second.Snapshot().Items.Select(item => item.Id).ToHashSet();
        Assert.Equal(10, ids.Count);
        Assert.Contains(EntryId(1), ids);
        Assert.Contains(EntryId(10), ids);
    }

    [Fact]
    public void ConvenienceAddCreatesStableNonEmptyIdentity()
    {
        using var sandbox = new NotificationStoreSandbox();
        var store = new NotificationHistoryStore(Path.Combine(sandbox.Path, "notification-history.json"));
        var timestamp = new DateTimeOffset(2026, 7, 29, 23, 0, 0, TimeSpan.FromHours(2));

        var result = store.Add("success", "Saved", "Settings were saved.", timestamp: timestamp);

        Assert.True(result.Succeeded);
        Assert.NotNull(result.ChangedEntry);
        Assert.NotEqual(Guid.Empty, result.ChangedEntry.Id);
        Assert.Equal(timestamp, result.ChangedEntry.Timestamp);
        Assert.Equal(result.ChangedEntry, Assert.Single(store.Snapshot().Items));
    }

    private static NotificationHistoryEntry Entry(int index, DateTimeOffset timestamp) => new(
        EntryId(index),
        timestamp,
        index % 2 == 0 ? "info" : "success",
        "Title " + index,
        "Body " + index);

    private static Guid EntryId(int index)
    {
        Span<byte> bytes = stackalloc byte[16];
        BitConverter.TryWriteBytes(bytes, index + 1);
        return new Guid(bytes);
    }
}

internal sealed class NotificationStoreSandbox : IDisposable
{
    public NotificationStoreSandbox()
    {
        Path = System.IO.Path.Combine(
            System.IO.Path.GetTempPath(),
            "mwd-notification-tests-" + Guid.NewGuid().ToString("N"));
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

internal sealed class HeldNamedMutex : IDisposable
{
    private static readonly TimeSpan CoordinationTimeout = TimeSpan.FromSeconds(5);

    private readonly ManualResetEventSlim _ready = new(false);
    private readonly ManualResetEventSlim _release = new(false);
    private readonly Thread _ownerThread;
    private Exception? _failure;

    public HeldNamedMutex(string name)
    {
        _ownerThread = new Thread(() =>
        {
            try
            {
                using var mutex = new Mutex(false, name);
                mutex.WaitOne();
                _ready.Set();
                _release.Wait();
                mutex.ReleaseMutex();
            }
            catch (Exception exception)
            {
                _failure = exception;
                _ready.Set();
            }
        })
        {
            IsBackground = true,
            Name = "Notification history mutex test owner",
        };
        _ownerThread.Start();

        if (!_ready.Wait(CoordinationTimeout))
        {
            _release.Set();
            throw new TimeoutException("The notification-history test mutex was not acquired in time.");
        }
        if (_failure is not null)
        {
            _release.Set();
            _ownerThread.Join(CoordinationTimeout);
            throw new InvalidOperationException("The notification-history test mutex could not be acquired.", _failure);
        }
    }

    public void Dispose()
    {
        _release.Set();
        if (!_ownerThread.Join(CoordinationTimeout))
            throw new TimeoutException("The notification-history test mutex owner did not exit in time.");
        _ready.Dispose();
        _release.Dispose();
        if (_failure is not null)
            throw new InvalidOperationException("The notification-history test mutex owner failed.", _failure);
    }
}
