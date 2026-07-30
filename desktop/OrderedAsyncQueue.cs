using System;
using System.Runtime.ExceptionServices;
using System.Threading.Tasks;

namespace WorldDownloaderManager;

/// <summary>
/// Small in-process operation tail: work executes in enqueue order, a failed item does not poison
/// later work, and DrainAsync follows items appended while a drain is already waiting.
/// </summary>
internal sealed class OrderedAsyncQueue
{
    private readonly object _sync = new();
    private Task _tail = Task.CompletedTask;

    public Task Enqueue(Func<Task> operation)
    {
        ArgumentNullException.ThrowIfNull(operation);
        lock (_sync)
        {
            _tail = RunAfterAsync(_tail, operation);
            return _tail;
        }
    }

    public Task<T> Enqueue<T>(Func<Task<T>> operation)
    {
        ArgumentNullException.ThrowIfNull(operation);
        lock (_sync)
        {
            var scheduled = RunAfterAsync(_tail, operation);
            _tail = scheduled;
            return scheduled;
        }
    }

    public async Task DrainAsync()
    {
        ExceptionDispatchInfo? failure = null;
        while (true)
        {
            Task observed;
            lock (_sync) observed = _tail;
            try { await observed; }
            catch (Exception ex) { failure ??= ExceptionDispatchInfo.Capture(ex); }
            lock (_sync)
            {
                if (!ReferenceEquals(observed, _tail)) continue;
            }
            failure?.Throw();
            return;
        }
    }

    private static async Task RunAfterAsync(Task previous, Func<Task> operation)
    {
        try { await previous; } catch { /* each queued operation owns its own result */ }
        await operation();
    }

    private static async Task<T> RunAfterAsync<T>(Task previous, Func<Task<T>> operation)
    {
        try { await previous; } catch { /* each queued operation owns its own result */ }
        return await operation();
    }
}
