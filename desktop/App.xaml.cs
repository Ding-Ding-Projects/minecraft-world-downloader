using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;

namespace WorldDownloaderManager;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        // Win32 off-screen desktops have no DWM surface for WPF's hardware renderer. The capture
        // harness opts into software rendering so PrintWindow receives real pixels; normal launches
        // keep hardware acceleration.
        if (Environment.GetEnvironmentVariable("MWD_HEADLESS_QA") == "1")
            RenderOptions.ProcessRenderMode = RenderMode.SoftwareOnly;

        // Surface and log any crash instead of the window silently vanishing, and keep the app alive
        // through non-fatal UI errors (e.g. a bad theme/render action) rather than terminating.
        DispatcherUnhandledException += (_, ev) => { Report(ev.Exception, "UI"); ev.Handled = true; };
        AppDomain.CurrentDomain.UnhandledException += (_, ev) => Report(ev.ExceptionObject as Exception, "fatal");
        TaskScheduler.UnobservedTaskException += (_, ev) => { Report(ev.Exception, "task"); ev.SetObserved(); };
        base.OnStartup(e);
    }

    internal static string LogPath
    {
        get
        {
            var dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "WorldDownloaderManager");
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "crash.log");
        }
    }

    private static void Report(Exception? ex, string source)
    {
        if (ex == null) return;
        string path = "(could not write log)";
        try
        {
            path = LogPath;
            File.AppendAllText(path, $"[{DateTime.Now:u}] ({source})\n{ex}\n\n");
        }
        catch { /* ignore logging failures */ }
        try
        {
            MessageBox.Show(
                $"World Downloader Manager hit an error ({source}):\n\n{ex.Message}\n\nDetails were saved to:\n{path}",
                "World Downloader Manager", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        catch { /* no UI available */ }
    }
}
