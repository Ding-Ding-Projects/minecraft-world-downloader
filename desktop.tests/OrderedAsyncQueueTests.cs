using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using WorldDownloaderManager;
using Xunit;

namespace WorldDownloaderManager.Tests;

public sealed class OrderedAsyncQueueTests
{
    [Fact]
    public async Task OperationsExecuteStrictlyInEnqueueOrder()
    {
        var queue = new OrderedAsyncQueue();
        var releaseFirst = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var order = new List<int>();
        var first = queue.Enqueue(async () =>
        {
            order.Add(1);
            await releaseFirst.Task;
            order.Add(2);
        });
        var second = queue.Enqueue(() =>
        {
            order.Add(3);
            return Task.CompletedTask;
        });

        await Task.Yield();
        Assert.Equal(new[] { 1 }, order);
        releaseFirst.SetResult();
        await Task.WhenAll(first, second);

        Assert.Equal(new[] { 1, 2, 3 }, order);
    }

    [Fact]
    public async Task DrainFollowsWorkAppendedWhileItIsWaiting()
    {
        var queue = new OrderedAsyncQueue();
        var releaseFirst = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseSecond = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var first = queue.Enqueue(() => releaseFirst.Task);
        var drain = queue.DrainAsync();
        var second = queue.Enqueue(() => releaseSecond.Task);

        releaseFirst.SetResult();
        await Task.Yield();
        Assert.False(drain.IsCompleted);
        releaseSecond.SetResult();
        await Task.WhenAll(first, second, drain);
    }

    [Fact]
    public async Task FailedOperationDoesNotPoisonItsSuccessor()
    {
        var queue = new OrderedAsyncQueue();
        var first = queue.Enqueue(() => Task.FromException(new InvalidOperationException("synthetic")));
        var secondRan = false;
        var second = queue.Enqueue(() =>
        {
            secondRan = true;
            return Task.CompletedTask;
        });

        await Assert.ThrowsAsync<InvalidOperationException>(() => first);
        await second;
        await queue.DrainAsync();
        Assert.True(secondRan);
    }

    [Fact]
    public async Task DrainFollowsLaterWorkAfterObservedTailFailsThenReportsTheFailure()
    {
        var queue = new OrderedAsyncQueue();
        var releaseFailure = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var first = queue.Enqueue(async () =>
        {
            await releaseFailure.Task;
            throw new InvalidOperationException("synthetic drain failure");
        });
        var drain = queue.DrainAsync();
        var successorRan = false;
        var successor = queue.Enqueue(() =>
        {
            successorRan = true;
            return Task.CompletedTask;
        });

        releaseFailure.SetResult();
        await Assert.ThrowsAsync<InvalidOperationException>(() => first);
        await successor;
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => drain);

        Assert.True(successorRan);
        Assert.Equal("synthetic drain failure", error.Message);
    }
}
