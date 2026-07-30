using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using WorldDownloaderManager;
using Xunit;

namespace WorldDownloaderManager.Tests;

public sealed class BotRunContextTests
{
    [Fact]
    public void CancellationBeforeLaunchNeverInvokesProcessFactory()
    {
        using var run = new BotRunContext(_ => { });
        run.Cancel();
        bool invoked = false;

        var process = run.TryStartProcess(() =>
        {
            invoked = true;
            return new Process();
        });

        Assert.Null(process);
        Assert.False(invoked);
        Assert.True(run.IsCancellationRequested);
    }

    [Fact]
    public void RepeatedCancellationRetriesTerminationUntilConfirmedDisposal()
    {
        var terminationAttempts = 0;
        using var run = new BotRunContext(_ => terminationAttempts++);
        Assert.NotNull(run.TryStartProcess(() => new Process()));

        run.Cancel();
        run.Cancel();

        Assert.Equal(2, terminationAttempts);
        Assert.False(run.Completion.IsCompleted);
    }

    [Fact]
    public void CancellationBeforeConfigNeverCreatesPlaintext()
    {
        using var run = new BotRunContext(_ => { });
        run.Cancel();
        bool invoked = false;

        var path = run.TryCreateConfig(() =>
        {
            invoked = true;
            throw new InvalidOperationException("The factory must not run.");
        });

        Assert.Null(path);
        Assert.False(invoked);
    }

    [Fact]
    public void RunningConfigLeaseSurvivesCancelUntilConfirmedLifetimeCleanup()
    {
        var directory = CreateSandbox();
        try
        {
            var terminated = false;
            var run = new BotRunContext(_ => terminated = true);
            var path = run.TryCreateConfig(() => EphemeralBotConfig.Create(
                new Dictionary<string, object?> { ["loginPassword"] = "synthetic-secret" }, directory));
            var process = run.TryStartProcess(() => new Process());

            run.Cancel();

            Assert.True(terminated);
            Assert.False(run.Completion.IsCompleted);
            Assert.NotNull(process);
            Assert.NotNull(path);
            Assert.True(File.Exists(path));

            run.Dispose();
            Assert.True(run.Completion.IsCompletedSuccessfully);
            Assert.False(File.Exists(path));
        }
        finally
        {
            if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
        }
    }

    [Fact]
    public void CompletedDependencyProcessCanBeReplacedByNodeProcess()
    {
        using var run = new BotRunContext(_ => { });
        var dependency = run.TryStartProcess(() => new Process());
        Assert.NotNull(dependency);

        run.ReleaseProcess(dependency!);
        var node = run.TryStartProcess(() => new Process());

        Assert.NotNull(node);
        Assert.Same(node, run.Process);
    }

    private static string CreateSandbox()
    {
        var path = Path.Combine(Path.GetTempPath(), "mwd-bot-run-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }
}
