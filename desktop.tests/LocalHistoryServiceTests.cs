using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using LibGit2Sharp;
using WorldDownloaderManager;
using Xunit;

namespace WorldDownloaderManager.Tests;

public sealed class LocalHistoryServiceTests
{
    private static readonly DateTimeOffset SameSecond =
        new(2026, 7, 29, 21, 30, 0, TimeSpan.FromHours(-4));

    [Fact]
    public void RestoreCreatesNewChildForEqualTreeAndCanBeUndone()
    {
        using var sandbox = new HistorySandbox();
        var repositoryPath = Path.Combine(sandbox.Path, "History");
        var history = NewHistory(repositoryPath, sandbox.Path);
        var first = history.RecordSettingsSnapshot(SettingsJson(8080))!;
        var second = history.RecordSettingsSnapshot(SettingsJson(9090))!;

        var restored = history.RestoreSettingsSnapshot(first.Sha);
        Assert.Equal(8080, ReadPort(restored.SettingsJson));
        Assert.Equal(first.Sha, restored.RestoredFromSha);
        AssertCommitParentAndRestoreTrailer(repositoryPath, restored.Revision.Sha, second.Sha, first.Sha);

        // Restoring the same tree again must still be an explicit, append-only revision.
        var equalTreeRestore = history.RestoreSettingsSnapshot(first.Sha);
        AssertCommitParentAndRestoreTrailer(
            repositoryPath, equalTreeRestore.Revision.Sha, restored.Revision.Sha, first.Sha);

        // Undo the restore by restoring the state that was current immediately before it.
        var undo = history.RestoreSettingsSnapshot(second.Sha);
        Assert.Equal(9090, ReadPort(undo.SettingsJson));
        AssertCommitParentAndRestoreTrailer(
            repositoryPath, undo.Revision.Sha, equalTreeRestore.Revision.Sha, second.Sha);
        Assert.Equal(5, history.GetRevisions().Count);
    }

    [Fact]
    public void LabelsSurvivePruningAndRemainAttachedToRetainedSnapshots()
    {
        using var sandbox = new HistorySandbox();
        var history = NewHistory(Path.Combine(sandbox.Path, "History"), sandbox.Path);
        for (var port = 8080; port < 8084; port++)
            history.RecordSettingsSnapshot(SettingsJson(port));

        var newest = history.GetRevisions();
        history.LabelRevision(newest[0].Sha, "Known-good current ports");
        history.LabelRevision(newest[1].Sha, "Before the final port change");

        Assert.Equal(2, history.PruneToLatest(2));

        var retained = history.GetRevisions();
        Assert.Equal(2, retained.Count);
        Assert.Equal("Known-good current ports", retained[0].Label);
        Assert.Equal("Before the final port change", retained[1].Label);
        Assert.Equal(new[] { 8083, 8082 }, retained.Select(r => ReadPort(history.GetSnapshot(r.Sha))));
    }

    [Fact]
    public void SameSecondRevisionsUseTopologicalNewestFirstOrder()
    {
        using var sandbox = new HistorySandbox();
        var history = NewHistory(Path.Combine(sandbox.Path, "History"), sandbox.Path);
        history.RecordSettingsSnapshot(SettingsJson(8080));
        history.RecordSettingsSnapshot(SettingsJson(8081));
        history.RecordSettingsSnapshot(SettingsJson(8082));

        var ports = history.GetRevisions()
            .Select(revision => ReadPort(history.GetSnapshot(revision.Sha)))
            .ToArray();

        Assert.Equal(new[] { 8082, 8081, 8080 }, ports);
        Assert.All(history.GetRevisions(), revision => Assert.Equal(SameSecond, revision.Timestamp));
    }

    [Fact]
    public void PruneFailureAfterBackupMoveRestoresOriginalAndCleansTemporaryCopies()
    {
        using var sandbox = new HistorySandbox();
        var repositoryPath = Path.Combine(sandbox.Path, "History");
        var history = new LocalHistoryService(
            repositoryPath,
            sandbox.Path,
            () => SameSecond,
            phase =>
            {
                if (phase == HistoryPrunePhase.AfterOriginalMoved)
                    throw new InvalidOperationException("Injected prune transition failure.");
            });
        for (var port = 8080; port < 8084; port++)
            history.RecordSettingsSnapshot(SettingsJson(port));
        var originalShas = history.GetRevisions().Select(revision => revision.Sha).ToArray();

        Assert.Throws<InvalidOperationException>(() => history.PruneToLatest(2));

        var reopened = NewHistory(repositoryPath, sandbox.Path);
        Assert.Equal(originalShas, reopened.GetRevisions().Select(revision => revision.Sha));
        Assert.Empty(Directory.EnumerateDirectories(sandbox.Path, "History.backup-*"));
        Assert.Empty(Directory.EnumerateDirectories(sandbox.Path, "History.rebuild-*"));
        Assert.Empty(Directory.EnumerateDirectories(sandbox.Path, "History.failed-*"));
    }

    [Fact]
    public void PruneFailureDuringRebuildCleansTemporaryRepository()
    {
        using var sandbox = new HistorySandbox();
        var repositoryPath = Path.Combine(sandbox.Path, "History");
        var history = new LocalHistoryService(
            repositoryPath,
            sandbox.Path,
            () => SameSecond,
            phase =>
            {
                if (phase == HistoryPrunePhase.AfterRebuildInitialized)
                    throw new InvalidOperationException("Injected rebuild failure.");
            });
        for (var port = 8080; port < 8084; port++)
            history.RecordSettingsSnapshot(SettingsJson(port));
        var originalShas = history.GetRevisions().Select(revision => revision.Sha).ToArray();

        Assert.Throws<InvalidOperationException>(() => history.PruneToLatest(2));

        var reopened = NewHistory(repositoryPath, sandbox.Path);
        Assert.Equal(originalShas, reopened.GetRevisions().Select(revision => revision.Sha));
        Assert.Empty(Directory.EnumerateDirectories(sandbox.Path, "History.rebuild-*"));
        Assert.Empty(Directory.EnumerateDirectories(sandbox.Path, "History.backup-*"));
        Assert.Empty(Directory.EnumerateDirectories(sandbox.Path, "History.failed-*"));
    }

    [Fact]
    public void PruneValidationFailureCleansTemporaryRepository()
    {
        using var sandbox = new HistorySandbox();
        var repositoryPath = Path.Combine(sandbox.Path, "History");
        var history = new LocalHistoryService(
            repositoryPath,
            sandbox.Path,
            () => SameSecond,
            phase =>
            {
                if (phase != HistoryPrunePhase.BeforeRebuildValidation) return;
                var rebuildPath = Assert.Single(
                    Directory.EnumerateDirectories(sandbox.Path, "History.rebuild-*"));
                using var rebuilt = new Repository(rebuildPath);
                rebuilt.Network.Remotes.Add("unexpected", "https://example.invalid/history.git");
            });
        for (var port = 8080; port < 8084; port++)
            history.RecordSettingsSnapshot(SettingsJson(port));
        var originalShas = history.GetRevisions().Select(revision => revision.Sha).ToArray();

        var error = Assert.Throws<InvalidOperationException>(() => history.PruneToLatest(2));

        Assert.Contains("must not have a remote", error.Message);
        var reopened = NewHistory(repositoryPath, sandbox.Path);
        Assert.Equal(originalShas, reopened.GetRevisions().Select(revision => revision.Sha));
        Assert.Empty(Directory.EnumerateDirectories(sandbox.Path, "History.rebuild-*"));
        Assert.Empty(Directory.EnumerateDirectories(sandbox.Path, "History.backup-*"));
        Assert.Empty(Directory.EnumerateDirectories(sandbox.Path, "History.failed-*"));
    }

    [Fact]
    public void PruneCleanupDeletesDirectoryReparsePointWithoutTraversingItsTarget()
    {
        using var sandbox = new HistorySandbox();
        var externalTarget = Path.Combine(sandbox.Path, "ExternalTarget");
        var probeLink = Path.Combine(sandbox.Path, "ReparseProbe");
        Directory.CreateDirectory(externalTarget);
        try
        {
            Directory.CreateSymbolicLink(probeLink, externalTarget);
            Directory.Delete(probeLink, recursive: false);
        }
        catch (Exception exception) when (exception is UnauthorizedAccessException or IOException or PlatformNotSupportedException)
        {
            return;
        }

        var sentinel = Path.Combine(externalTarget, "do-not-touch.txt");
        File.WriteAllText(sentinel, "outside the rebuild tree");
        File.SetAttributes(sentinel, FileAttributes.ReadOnly);

        var repositoryPath = Path.Combine(sandbox.Path, "History");
        var history = new LocalHistoryService(
            repositoryPath,
            sandbox.Path,
            () => SameSecond,
            phase =>
            {
                if (phase != HistoryPrunePhase.AfterRebuildInitialized) return;
                var rebuildPath = Assert.Single(
                    Directory.EnumerateDirectories(sandbox.Path, "History.rebuild-*"));
                Directory.CreateSymbolicLink(Path.Combine(rebuildPath, "escape"), externalTarget);
                throw new InvalidOperationException("Injected rebuild failure after adding a reparse point.");
            });
        for (var port = 8080; port < 8084; port++)
            history.RecordSettingsSnapshot(SettingsJson(port));

        Assert.Throws<InvalidOperationException>(() => history.PruneToLatest(2));

        Assert.True(Directory.Exists(externalTarget));
        Assert.True(File.Exists(sentinel));
        Assert.True((File.GetAttributes(sentinel) & FileAttributes.ReadOnly) != 0);
        Assert.Empty(Directory.EnumerateDirectories(sandbox.Path, "History.rebuild-*"));
    }

    [Fact]
    public void RepositoryWithRemoteIsRejected()
    {
        using var sandbox = new HistorySandbox();
        var repositoryPath = Path.Combine(sandbox.Path, "History");
        var history = NewHistory(repositoryPath, sandbox.Path);
        history.RecordSettingsSnapshot(SettingsJson(8080));
        using (var repository = new Repository(repositoryPath))
            repository.Network.Remotes.Add("origin", "https://example.invalid/history.git");

        var error = Assert.Throws<InvalidOperationException>(() => history.GetRevisions());
        Assert.Contains("must not have a remote", error.Message);
    }

    [Fact]
    public void RepositoryOutsideOwnedRootIsRejectedWithoutCreatingIt()
    {
        using var sandbox = new HistorySandbox();
        var ownedRoot = Path.Combine(sandbox.Path, "Owned");
        var outside = Path.Combine(sandbox.Path, "Outside", "History");
        Directory.CreateDirectory(ownedRoot);
        var history = NewHistory(outside, ownedRoot);

        var error = Assert.Throws<InvalidOperationException>(
            () => history.RecordSettingsSnapshot(SettingsJson(8080)));

        Assert.Contains("outside the app-owned data directory", error.Message);
        Assert.False(Directory.Exists(outside));
    }

    [Fact]
    public void RepositoryReparsePointIsRejectedWhenPlatformCanCreateOne()
    {
        using var sandbox = new HistorySandbox();
        var ownedRoot = Path.Combine(sandbox.Path, "Owned");
        var target = Path.Combine(sandbox.Path, "Target");
        var link = Path.Combine(ownedRoot, "History");
        Directory.CreateDirectory(ownedRoot);
        Directory.CreateDirectory(target);
        try
        {
            Directory.CreateSymbolicLink(link, target);
        }
        catch (Exception exception) when (exception is UnauthorizedAccessException or IOException or PlatformNotSupportedException)
        {
            return;
        }

        var history = NewHistory(link, ownedRoot);
        var error = Assert.Throws<InvalidOperationException>(
            () => history.RecordSettingsSnapshot(SettingsJson(8080)));
        Assert.Contains("symbolic links or reparse points", error.Message);
    }

    [Fact]
    public async Task SeparateServiceInstancesSerializeConcurrentWriters()
    {
        using var sandbox = new HistorySandbox();
        var repositoryPath = Path.Combine(sandbox.Path, "History");
        var writers = Enumerable.Range(0, 8)
            .Select(index => Task.Run(() =>
                NewHistory(repositoryPath, sandbox.Path)
                    .RecordSettingsSnapshot(SettingsJson(8100 + index))))
            .ToArray();

        await Task.WhenAll(writers);

        var history = NewHistory(repositoryPath, sandbox.Path);
        Assert.Equal(8, history.GetRevisions().Count);
        using var repository = new Repository(repositoryPath);
        Assert.Empty(repository.Network.Remotes);
    }

    [Fact]
    public void ProtectedDiffRedactsKnownAndFutureSecretLikeProperties()
    {
        var oldJson = JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["EncryptedPassword"] = "old-console-cipher",
            ["EncryptedBotLoginPassword"] = "old-bot-cipher",
            ["ApiToken"] = "old-api-token",
            ["Server"] = "old.example",
        });
        var newJson = JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["EncryptedPassword"] = "new-console-cipher",
            ["EncryptedBotLoginPassword"] = "new-bot-cipher",
            ["ApiToken"] = "new-api-token",
            ["Server"] = "new.example",
        });

        var diff = LocalHistoryService.FormatJsonDiff(oldJson, newJson);

        Assert.Equal(3, CountOccurrences(diff, "protected value changed"));
        Assert.DoesNotContain("console-cipher", diff);
        Assert.DoesNotContain("bot-cipher", diff);
        Assert.DoesNotContain("api-token", diff);
        Assert.Contains("old.example", diff);
        Assert.Contains("new.example", diff);
    }

    private static LocalHistoryService NewHistory(string repositoryPath, string ownedRoot) =>
        new(repositoryPath, ownedRoot, () => SameSecond);

    private static string SettingsJson(int port) =>
        JsonSerializer.Serialize(new Settings { WebPort = port });

    private static int ReadPort(string json) =>
        JsonSerializer.Deserialize<Settings>(json)!.WebPort;

    private static void AssertCommitParentAndRestoreTrailer(
        string repositoryPath,
        string commitSha,
        string expectedParentSha,
        string restoredFromSha)
    {
        using var repository = new Repository(repositoryPath);
        var commit = repository.Lookup<Commit>(commitSha)!;
        Assert.Equal(expectedParentSha, Assert.Single(commit.Parents).Sha);
        Assert.Contains("Restore-From: " + restoredFromSha, commit.Message);
    }

    private static int CountOccurrences(string text, string value)
    {
        var count = 0;
        var offset = 0;
        while ((offset = text.IndexOf(value, offset, StringComparison.Ordinal)) >= 0)
        {
            count++;
            offset += value.Length;
        }
        return count;
    }
}

internal sealed class HistorySandbox : IDisposable
{
    public HistorySandbox()
    {
        Path = System.IO.Path.Combine(
            System.IO.Path.GetTempPath(),
            "mwd-history-tests-" + Guid.NewGuid().ToString("N"));
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
