using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace WorldDownloaderManager;

/// <summary>
/// Owns one bot start attempt from dependency preparation through process exit. Cancellation and
/// process launch share a gate, so a cancelled attempt can never launch a later process.
/// </summary>
internal sealed class BotRunContext : IDisposable
{
    private readonly object _gate = new();
    private readonly Action<Process> _terminateProcess;
    private readonly CancellationTokenSource _cancellation = new();
    private readonly TaskCompletionSource _completion = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private Process? _process;
    private EphemeralBotConfig? _config;
    private bool _cancelled;
    private bool _disposed;
    private int _exitHandlingStarted;

    public BotRunContext(Action<Process>? terminateProcess = null)
    {
        _terminateProcess = terminateProcess ?? TerminateProcess;
    }

    public CancellationToken CancellationToken => _cancellation.Token;
    public Task Completion => _completion.Task;

    public bool IsCancellationRequested
    {
        get
        {
            lock (_gate) return _cancelled;
        }
    }

    public Process? Process
    {
        get
        {
            lock (_gate) return _process;
        }
    }

    /// <summary>
    /// Creates and owns the plaintext configuration only while this attempt is still active.
    /// The factory executes under the same gate as cancellation so cleanup cannot miss the file.
    /// </summary>
    public string? TryCreateConfig(Func<EphemeralBotConfig> configFactory)
    {
        ArgumentNullException.ThrowIfNull(configFactory);
        lock (_gate)
        {
            if (_cancelled || _disposed) return null;
            if (_config is not null) throw new InvalidOperationException("The bot configuration already exists.");
            _config = configFactory();
            return _config.Path;
        }
    }

    /// <summary>
    /// Starts either the dependency installer or Node while atomically excluding cancellation.
    /// If cancellation won first, the factory is never invoked.
    /// </summary>
    public Process? TryStartProcess(Func<Process?> processFactory)
    {
        ArgumentNullException.ThrowIfNull(processFactory);
        lock (_gate)
        {
            if (_cancelled || _disposed) return null;
            if (_process is not null) throw new InvalidOperationException("A bot process is already tracked.");
            _process = processFactory();
            return _process;
        }
    }

    /// <summary>Releases a completed dependency installer before the Node process is launched.</summary>
    public void ReleaseProcess(Process process)
    {
        ArgumentNullException.ThrowIfNull(process);
        bool release;
        lock (_gate)
        {
            release = ReferenceEquals(_process, process);
            if (release) _process = null;
        }
        if (release)
        {
            try { process.Dispose(); } catch { /* best-effort process cleanup */ }
        }
    }

    public bool TryBeginExitHandling() =>
        Interlocked.Exchange(ref _exitHandlingStarted, 1) == 0;

    public void Cancel()
    {
        Process? process;
        bool signalCancellation;
        lock (_gate)
        {
            if (_disposed) return;
            signalCancellation = !_cancelled;
            _cancelled = true;
            process = _process;
        }

        if (signalCancellation)
        {
            try { _cancellation.Cancel(); } catch (ObjectDisposedException) { /* already shutting down */ }
        }
        if (process is not null) _terminateProcess(process);
    }

    public void Dispose()
    {
        Cancel();

        Process? process;
        EphemeralBotConfig? config;
        lock (_gate)
        {
            if (_disposed) return;
            _disposed = true;
            process = _process;
            _process = null;
            config = _config;
            _config = null;
        }

        try { process?.Dispose(); } catch { /* best-effort process cleanup */ }
        config?.Dispose();
        _cancellation.Dispose();
        _completion.TrySetResult();
    }

    private static void TerminateProcess(Process process)
    {
        try
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
        }
        catch { /* best-effort stop; exit handling retains the config lease */ }
    }
}
