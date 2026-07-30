using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using System.Threading.Tasks;

namespace WorldDownloaderManager;

/// <summary>Thin wrapper around the docker CLI.</summary>
public class DockerService
{
    public Action<string>? OnOutput;

    private void Log(string text) => OnOutput?.Invoke(text);

    public async Task<(int code, string output)> RunAsync(IReadOnlyList<string> args, bool log = true)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "docker",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);

        var sb = new StringBuilder();
        var outputGate = new object();
        try
        {
            if (log) Log("$ docker " + FormatArgumentsForLog(args));
            using var p = new Process { StartInfo = psi, EnableRaisingEvents = true };
            p.OutputDataReceived += (_, e) =>
            {
                if (e.Data == null) return;
                lock (outputGate) sb.AppendLine(e.Data);
                if (log) Log(e.Data);
            };
            p.ErrorDataReceived += (_, e) =>
            {
                if (e.Data == null) return;
                lock (outputGate) sb.AppendLine(e.Data);
                if (log) Log(e.Data);
            };
            p.Start();
            p.BeginOutputReadLine();
            p.BeginErrorReadLine();
            await p.WaitForExitAsync();
            return (p.ExitCode, sb.ToString());
        }
        catch (Exception ex)
        {
            Log("Error: " + ex.Message + "  (Is Docker Desktop installed and running?)");
            return (-1, ex.Message);
        }
    }

    internal static string FormatArgumentsForLog(IReadOnlyList<string> args)
    {
        var safe = new List<string>(args.Count);
        bool environmentValueFollows = false;
        foreach (var argument in args)
        {
            if (environmentValueFollows)
            {
                var equals = argument.IndexOf('=');
                var key = equals >= 0 ? argument[..equals] : argument;
                bool sensitive = key.Contains("PASSWORD", StringComparison.OrdinalIgnoreCase) ||
                                 key.Contains("TOKEN", StringComparison.OrdinalIgnoreCase) ||
                                 key.Contains("SECRET", StringComparison.OrdinalIgnoreCase) ||
                                 key.Contains("KEY", StringComparison.OrdinalIgnoreCase);
                safe.Add(sensitive && equals >= 0 ? key + "=<redacted>" : argument);
                environmentValueFollows = false;
                continue;
            }

            safe.Add(argument);
            environmentValueFollows = argument is "-e" or "--env";
        }
        return string.Join(" ", safe);
    }

    public async Task<bool> IsDockerAvailableAsync()
    {
        var (code, _) = await RunAsync(new[] { "version", "--format", "{{.Server.Version}}" }, log: false);
        return code == 0;
    }

    public async Task<bool> IsRunningAsync(string container)
    {
        var (code, output) = await RunAsync(
            new[] { "ps", "--filter", $"name=^/{container}$", "--filter", "status=running", "--format", "{{.Names}}" },
            log: false);
        return code == 0 && output.Trim().Length > 0;
    }

    public Task RemoveAsync(string container) =>
        RunAsync(new[] { "rm", "-f", container }, log: false);

    public Task<(int, string)> PullAsync(string image) =>
        RunAsync(new[] { "pull", image });

    /// <summary>Build the image from a local source folder (the build context, which must contain a Dockerfile).</summary>
    public Task<(int, string)> BuildAsync(string contextPath, string imageTag) =>
        RunAsync(new[] { "build", "-t", imageTag, contextPath });

    internal static IReadOnlyList<string> BuildRunArguments(Settings settings)
    {
        ArgumentNullException.ThrowIfNull(settings);
        var args = new List<string>
        {
            "run", "-d",
            "--name", settings.ContainerName,
            "--restart", "unless-stopped",
            "-p", settings.WebPortBinding,
            "-p", $"{settings.ProxyPort}:25565",
            "-v", $"{settings.DataFolder}:/data",
        };

        foreach (var item in settings.GetContainerEnvironment())
        {
            args.Add("-e");
            args.Add($"{item.Key}={item.Value}");
        }

        args.Add(settings.EffectiveImage);
        return args;
    }

    public Task<(int, string)> RunContainerAsync(Settings settings)
    {
        try
        {
            return RunAsync(BuildRunArguments(settings));
        }
        catch (InvalidOperationException ex)
        {
            // Authentication validation errors contain no protected value. Fail without invoking
            // Docker so requested login protection can never be silently dropped.
            Log("Error: " + ex.Message);
            return Task.FromResult((-1, ex.Message));
        }
    }
}
