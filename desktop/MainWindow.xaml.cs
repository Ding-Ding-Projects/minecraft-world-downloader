using System;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace WorldDownloaderManager;

public partial class MainWindow : Window
{
    private readonly Settings _settings;
    private readonly DockerService _docker = new();
    private Process? _botProc;
    private bool _loadingPreferences = true;
    private bool _settingsSearchUsesRegex;
    private bool _startupHealthy;
    private readonly ObservableCollection<string> _notificationHistory = new();
    private readonly DispatcherTimer _toastTimer = new() { Interval = TimeSpan.FromSeconds(6) };
    private readonly DispatcherTimer _dimSumTimer = new() { Interval = TimeSpan.FromSeconds(8) };

    public MainWindow()
    {
        InitializeComponent();

        _settings = Settings.Load();
        _docker.OnOutput = AppendLog;

        FolderBox.Text = _settings.DataFolder;
        WebPortBox.Text = _settings.WebPort.ToString();
        ProxyPortBox.Text = _settings.ProxyPort.ToString();
        ServerBox.Text = _settings.Server;
        OutputDirBox.Text = _settings.OutputDir;
        AutoStartCheck.IsChecked = _settings.AutoStart;
        ImageBox.Text = _settings.Image;
        LoginCheck.IsChecked = _settings.RequireLogin;
        UserBox.Text = _settings.Username;
        PassBox.Password = _settings.Password;
        LoginPanel.Visibility = _settings.RequireLogin ? Visibility.Visible : Visibility.Collapsed;
        BuildLocalCheck.IsChecked = _settings.BuildLocally;
        BuildContextBox.Text = _settings.BuildContext;
        BuildPanel.Visibility = _settings.BuildLocally ? Visibility.Visible : Visibility.Collapsed;
        PullBtn.IsEnabled = !_settings.BuildLocally;

        InitializePreferences();
        NotificationHistoryList.ItemsSource = _notificationHistory;
        _toastTimer.Tick += (_, _) => { _toastTimer.Stop(); ToastBorder.Visibility = Visibility.Collapsed; };
        _dimSumTimer.Tick += (_, _) => { _dimSumTimer.Stop(); DimSumToast.Visibility = Visibility.Collapsed; };

        Loaded += async (_, _) =>
        {
            await InitAsync();
            if (_settings.HasCompletedFirstRun && _startupHealthy) MaybeShowDimSum();
            if (!_settings.HasCompletedFirstRun)
            {
                _settings.HasCompletedFirstRun = true;
                _settings.Save();
            }
        };
    }

    private async Task InitAsync()
    {
        try
        {
            if (!await _docker.IsDockerAvailableAsync())
            {
                SetStatus("error", "Docker not found. Install Docker Desktop and make sure it is running, then reopen this app.");
                return;
            }
            await RefreshStatusAsync();
            _startupHealthy = true;
        }
        catch (Exception ex)
        {
            // never let the startup status check take the whole app down
            SetStatus("error", "Could not check Docker status: " + ex.Message);
        }
    }

    private static int ParsePort(string text, int fallback) =>
        int.TryParse(text, out var v) && v is > 0 and < 65536 ? v : fallback;

    private void SaveFromUi()
    {
        _settings.DataFolder = FolderBox.Text.Trim();
        _settings.WebPort = ParsePort(WebPortBox.Text, 8080);
        _settings.ProxyPort = ParsePort(ProxyPortBox.Text, 25565);
        _settings.Server = ServerBox.Text.Trim();
        _settings.OutputDir = string.IsNullOrWhiteSpace(OutputDirBox.Text) ? "world" : OutputDirBox.Text.Trim();
        _settings.AutoStart = AutoStartCheck.IsChecked == true;
        if (!string.IsNullOrWhiteSpace(ImageBox.Text)) _settings.Image = ImageBox.Text.Trim();
        _settings.RequireLogin = LoginCheck.IsChecked == true;
        _settings.Username = UserBox.Text.Trim();
        _settings.Password = PassBox.Password;
        _settings.BuildLocally = BuildLocalCheck.IsChecked == true;
        _settings.BuildContext = BuildContextBox.Text.Trim();
        _settings.Save();
    }

    private void SetStatus(string kind, string text)
    {
        string bg = kind switch
        {
            "success" => "#16291E",
            "error" => "#2A1718",
            "warn" => "#2A2516",
            _ => "#1B2733",
        };
        string fg = kind switch
        {
            "success" => "#3DDC84",
            "error" => "#FF8A85",
            "warn" => "#FFCA52",
            _ => "#E9EEF5",
        };
        StatusBorder.Background = Brush(bg);
        StatusText.Foreground = Brush(fg);
        StatusText.Text = text;
        ShowToast(kind, kind switch
        {
            "success" => "Completed",
            "error" => "Action needed",
            "warn" => "Check this",
            _ => "World Downloader",
        }, text);
    }

    private void ShowToast(string kind, string title, string body)
    {
        if (ToastBorder is null) return;
        _notificationHistory.Insert(0, $"{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss zzz}  [{kind.ToUpperInvariant()}]  {title} — {body}");
        ToastTitle.Text = title;
        ToastBody.Text = body;
        ToastBorder.BorderBrush = Brush(kind switch
        {
            "success" => "#3DDC84",
            "error" => "#FF8A85",
            "warn" => "#FFCA52",
            _ => "#93A1B5",
        });
        ToastBorder.Visibility = Visibility.Visible;
        _toastTimer.Stop();
        if (kind is not ("error" or "warn")) _toastTimer.Start();
    }

    private void DismissToast_Click(object sender, RoutedEventArgs e)
    {
        _toastTimer.Stop();
        ToastBorder.Visibility = Visibility.Collapsed;
    }

    private void ClearNotifications_Click(object sender, RoutedEventArgs e) => _notificationHistory.Clear();

    private static SolidColorBrush Brush(string hex) =>
        new((Color)ColorConverter.ConvertFromString(hex));

    private void Busying(bool on)
    {
        Busy.Visibility = on ? Visibility.Visible : Visibility.Collapsed;
        StartBtn.IsEnabled = !on;
        StopBtn.IsEnabled = !on;
        // "Update image" pulls the prebuilt image — keep it disabled while busy and when building locally.
        PullBtn.IsEnabled = !on && BuildLocalCheck.IsChecked != true;
        BrowseBtn.IsEnabled = !on;
    }

    private void AppendLog(string line) => Dispatcher.Invoke(() =>
    {
        LogText.AppendText(line + Environment.NewLine);
        LogText.ScrollToEnd();
    });

    private async Task RefreshStatusAsync()
    {
        bool running = await _docker.IsRunningAsync(_settings.ContainerName);
        StartBtn.IsEnabled = !running;
        StopBtn.IsEnabled = running;
        if (running)
            SetStatus("success", $"Running — console at http://localhost:{_settings.WebPort}   •   Minecraft proxy on localhost:{_settings.ProxyPort}");
        else
            SetStatus("info", "Stopped. Press Start to launch the console.");
    }

    private void Browse_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = "Choose the data folder" };
        if (!string.IsNullOrWhiteSpace(FolderBox.Text) && Directory.Exists(FolderBox.Text))
            dlg.InitialDirectory = FolderBox.Text;
        if (dlg.ShowDialog() == true)
            FolderBox.Text = dlg.FolderName;
    }

    private void Login_Changed(object sender, RoutedEventArgs e) =>
        LoginPanel.Visibility = LoginCheck.IsChecked == true ? Visibility.Visible : Visibility.Collapsed;

    private void BuildLocal_Changed(object sender, RoutedEventArgs e)
    {
        bool on = BuildLocalCheck.IsChecked == true;
        BuildPanel.Visibility = on ? Visibility.Visible : Visibility.Collapsed;
        // "Update image" pulls the prebuilt image, which doesn't apply when building locally.
        PullBtn.IsEnabled = !on;
    }

    private void BrowseBuildContext_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = "Choose the source folder (contains the Dockerfile)" };
        if (!string.IsNullOrWhiteSpace(BuildContextBox.Text) && Directory.Exists(BuildContextBox.Text))
            dlg.InitialDirectory = BuildContextBox.Text;
        if (dlg.ShowDialog() == true)
            BuildContextBox.Text = dlg.FolderName;
    }

    /// <summary>Resolve a build context: the configured folder if it has a Dockerfile, else auto-detect
    /// one near the app (so running from inside the repo just works). Returns null if none is found.</summary>
    private string? FindBuildContext()
    {
        if (!string.IsNullOrWhiteSpace(_settings.BuildContext))
        {
            try
            {
                var p = Path.GetFullPath(_settings.BuildContext);
                if (File.Exists(Path.Combine(p, "Dockerfile"))) return p;
            }
            catch { /* fall through to auto-detect */ }
        }
        foreach (var c in new[]
        {
            AppContext.BaseDirectory,
            Path.Combine(AppContext.BaseDirectory, ".."),
            Path.Combine(AppContext.BaseDirectory, "..", ".."),
            // dev layout: desktop/bin/Release/net8.0-windows/ -> repo root is four levels up
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."),
        })
        {
            try { var f = Path.GetFullPath(c); if (File.Exists(Path.Combine(f, "Dockerfile"))) return f; }
            catch { /* ignore */ }
        }
        return null;
    }

    private async void Start_Click(object sender, RoutedEventArgs e)
    {
        SaveFromUi();
        if (string.IsNullOrWhiteSpace(_settings.DataFolder))
        {
            SetStatus("warn", "Pick a data folder first — choose where worlds should be stored.");
            return;
        }

        // When building locally, resolve (and validate) the source folder up front.
        string? buildContext = null;
        if (_settings.BuildLocally)
        {
            buildContext = FindBuildContext();
            if (buildContext == null)
            {
                SetStatus("error", "Build locally is on, but no Dockerfile was found. Set the source folder " +
                                   "(the minecraft-world-downloader checkout that contains the Dockerfile).");
                return;
            }
        }

        Busying(true);
        try
        {
            Directory.CreateDirectory(_settings.DataFolder);
            await _docker.RemoveAsync(_settings.ContainerName);

            if (_settings.BuildLocally)
            {
                SetStatus("info", $"Building image locally from {buildContext} — the first build can take several minutes …");
                var (bcode, _) = await _docker.BuildAsync(buildContext!, Settings.LocalImageTag);
                if (bcode != 0)
                {
                    SetStatus("error", "Local build failed — see the output below.");
                    return;
                }
            }
            else
            {
                // Always pull the freshest published image before launching, so the web console / app is
                // never stale. Non-fatal: if the pull fails (offline, or a local-only image) we fall back
                // to whatever image is already cached and still try to run.
                SetStatus("info", "Updating image (docker pull) — first run can take a while …");
                await _docker.PullAsync(_settings.Image);
            }

            var (code, _) = await _docker.RunContainerAsync(_settings);
            if (code == 0)
            {
                SetStatus("success", $"Started. Opening http://localhost:{_settings.WebPort} …");
                OpenConsole();
            }
            else
            {
                SetStatus("error", _settings.BuildLocally
                    ? "Failed to start — see the output below."
                    : "Failed to start — see the output below. If the image is missing, press “Update image” first.");
            }
        }
        finally
        {
            Busying(false);
            await RefreshStatusAsync();
        }
    }

    private async void Stop_Click(object sender, RoutedEventArgs e)
    {
        Busying(true);
        try { await _docker.RemoveAsync(_settings.ContainerName); AppendLog("Stopped."); }
        finally { Busying(false); await RefreshStatusAsync(); }
    }

    private async void Pull_Click(object sender, RoutedEventArgs e)
    {
        SaveFromUi();
        Busying(true);
        try { await _docker.PullAsync(_settings.Image); }
        finally { Busying(false); }
    }

    private void GenerateCompose_Click(object sender, RoutedEventArgs e)
    {
        SaveFromUi();
        if (string.IsNullOrWhiteSpace(_settings.DataFolder))
        {
            SetStatus("warn", "Pick a data folder first — the docker-compose.yml is written there.");
            return;
        }
        try
        {
            var path = _settings.WriteDockerCompose();
            AppendLog("Wrote " + path);
            SetStatus("success", "docker-compose.yml written to the data folder. Run it with: docker compose up -d");
            try { Process.Start(new ProcessStartInfo(_settings.DataFolder) { UseShellExecute = true }); } catch { /* ignore */ }
        }
        catch (Exception ex) { SetStatus("error", "Could not write docker-compose.yml: " + ex.Message); }
    }

    private void Open_Click(object sender, RoutedEventArgs e) => OpenConsole();

    private void OpenLiveMap_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            int port = ParsePort(WebPortBox.Text, 8080);
            Process.Start(new ProcessStartInfo($"http://localhost:{port}/map") { UseShellExecute = true });
        }
        catch (Exception ex) { AppendLog("Could not open live map: " + ex.Message); }
    }

    private void OpenConsole()
    {
        try
        {
            int port = ParsePort(WebPortBox.Text, 8080);
            Process.Start(new ProcessStartInfo($"http://localhost:{port}") { UseShellExecute = true });
        }
        catch (Exception ex) { AppendLog("Could not open browser: " + ex.Message); }
    }

    // ---- Accessibility / theme ----------------------------------------------------------------
    private void Theme_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (ThemeBox == null) return;
        var name = (ThemeBox.SelectedItem as ComboBoxItem)?.Content?.ToString() ?? "Dark";
        ApplyTheme(name);
        if (!_loadingPreferences)
        {
            _settings.Theme = name;
            _settings.Save();
        }
    }

    private void LargeText_Changed(object sender, RoutedEventArgs e)
    {
        double s = LargeTextBox.IsChecked == true ? 1.25 : 1.0;
        if (RootScale != null) { RootScale.ScaleX = s * _settings.UiFontScale; RootScale.ScaleY = s * _settings.UiFontScale; }
        if (!_loadingPreferences)
        {
            _settings.LargeText = LargeTextBox.IsChecked == true;
            _settings.Save();
        }
    }

    private void SetBrush(string key, string hex)
    {
        var color = (Color)ColorConverter.ConvertFromString(hex);
        // brushes are declared po:Freeze="False" so we can recolour them live; if one is ever frozen,
        // replace it instead of throwing (keeps the window from crashing on launch)
        if (Resources[key] is SolidColorBrush b && !b.IsFrozen)
            b.Color = color;
        else
            Resources[key] = new SolidColorBrush(color);
    }

    private void ApplyTheme(string name)
    {
        switch (name)
        {
            case "Light":
                SetBrush("Bg", "#F4F6FB"); SetBrush("Surface", "#FFFFFF"); SetBrush("Surface2", "#EEF2F8");
                SetBrush("Outline", "#C7D0DE"); SetBrush("Text", "#16202E"); SetBrush("Muted", "#51607A");
                SetBrush("Accent", "#1A9E5B"); SetBrush("Danger", "#C4322D");
                break;
            case "High contrast":
                SetBrush("Bg", "#000000"); SetBrush("Surface", "#000000"); SetBrush("Surface2", "#0A0A0A");
                SetBrush("Outline", "#FFFFFF"); SetBrush("Text", "#FFFFFF"); SetBrush("Muted", "#F0F0F0");
                SetBrush("Accent", "#00E676"); SetBrush("Danger", "#FF6B6B");
                break;
            default: // Dark
                SetBrush("Bg", "#0F1419"); SetBrush("Surface", "#1A2029"); SetBrush("Surface2", "#222A35");
                SetBrush("Outline", "#313B49"); SetBrush("Text", "#E9EEF5"); SetBrush("Muted", "#93A1B5");
                SetBrush("Accent", "#3DDC84"); SetBrush("Danger", "#FF5C57");
                break;
        }
        if (Resources["Bg"] is SolidColorBrush bg) Background = bg;
    }

    // ---- BlueMap 3D map ----------------------------------------------------------------------
    private void BrowseJar_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new Microsoft.Win32.OpenFileDialog { Title = "Choose a server jar (Paper/vanilla)", Filter = "Jar files (*.jar)|*.jar|All files (*.*)|*.*" };
        if (dlg.ShowDialog() == true) ServerJarBox.Text = dlg.FileName;
    }

    private static string? FindPipeline(string dataFolder)
    {
        foreach (var c in new[]
        {
            Path.Combine(AppContext.BaseDirectory, "bluemap", "pipeline.py"),
            Path.Combine(AppContext.BaseDirectory, "..", "bluemap", "pipeline.py"),
            Path.Combine(dataFolder ?? "", "bluemap", "pipeline.py"),
        })
        {
            try { if (File.Exists(c)) return Path.GetFullPath(c); } catch { /* ignore */ }
        }
        return null;
    }

    private async void RenderMap_Click(object sender, RoutedEventArgs e)
    {
        SaveFromUi();
        if (string.IsNullOrWhiteSpace(_settings.DataFolder))
        {
            SetStatus("warn", "Pick a data folder first — the world to render lives there.");
            return;
        }
        var pipeline = FindPipeline(_settings.DataFolder);
        if (pipeline == null)
        {
            SetStatus("error", "Could not find bluemap/pipeline.py (expected next to the app or in the data folder).");
            return;
        }

        // world is <data>/world by default; BlueMap output + workdir live under <data>/bluemap
        string world = Path.Combine(_settings.DataFolder, "world");
        string workdir = Path.Combine(_settings.DataFolder, "bluemap");
        string webroot = Path.Combine(workdir, "web");
        Directory.CreateDirectory(workdir);

        // write settings.json from the UI fields
        var dims = new System.Collections.Generic.List<string>();
        if (BmOverworld.IsChecked == true) dims.Add("overworld");
        if (BmNether.IsChecked == true) dims.Add("nether");
        if (BmEnd.IsChecked == true) dims.Add("end");
        string settingsPath = Path.Combine(workdir, "settings.json");
        var sj = new System.Text.StringBuilder();
        sj.Append("{\"acceptDownload\":true,");
        sj.Append("\"renderThreadCount\":").Append(ParsePort(BmThreads.Text, 0)).Append(',');
        sj.Append("\"webserverEnabled\":true,");
        sj.Append("\"webserverPort\":").Append(ParsePort(BmPort.Text, 8100)).Append(',');
        sj.Append("\"dimensions\":[").Append(string.Join(",", dims.ConvertAll(d => "\"" + d + "\""))).Append("]}");
        try { File.WriteAllText(settingsPath, sj.ToString()); } catch (Exception ex) { AppendLog("Could not write BlueMap settings: " + ex.Message); }

        var args = new System.Collections.Generic.List<string> { pipeline, "all", "--world", world,
            "--out", webroot, "--workdir", workdir, "--settings", settingsPath };
        if (!string.IsNullOrWhiteSpace(ServerJarBox.Text)) { args.Add("--server-jar"); args.Add(ServerJarBox.Text); }

        Busying(true);
        SetStatus("info", "Rendering 3D map with BlueMap — this can take a while (and downloads textures the first time).");
        try
        {
            int code = await RunPythonAsync(args);
            if (code == 0) { SetStatus("success", $"3D map rendered. Open it at http://localhost:{ParsePort(BmPort.Text, 8100)} (start the web map server) or via 'Open 3D map'."); }
            else SetStatus("error", "BlueMap render failed — see the output below.");
        }
        catch (Exception ex) { SetStatus("error", "BlueMap render error: " + ex.Message); }
        finally { Busying(false); }
    }

    private void OpenMap_Click(object sender, RoutedEventArgs e)
    {
        try { Process.Start(new ProcessStartInfo($"http://localhost:{ParsePort(BmPort.Text, 8100)}") { UseShellExecute = true }); }
        catch (Exception ex) { AppendLog("Could not open 3D map: " + ex.Message); }
    }

    private async Task<int> RunPythonAsync(System.Collections.Generic.List<string> args)
    {
        foreach (var exe in new[] { "python", "python3", "py" })
        {
            var psi = new ProcessStartInfo(exe)
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            foreach (var a in args) psi.ArgumentList.Add(a);
            Process proc;
            try { proc = Process.Start(psi)!; }
            catch { continue; } // try the next python launcher
            proc.OutputDataReceived += (_, ev) => { if (ev.Data != null) AppendLog(ev.Data); };
            proc.ErrorDataReceived += (_, ev) => { if (ev.Data != null) AppendLog(ev.Data); };
            proc.BeginOutputReadLine();
            proc.BeginErrorReadLine();
            await proc.WaitForExitAsync();
            return proc.ExitCode;
        }
        AppendLog("Python was not found on PATH (tried python, python3, py).");
        return -1;
    }

    // ---- Auto-explore bot (mineflayer scraper) -----------------------------------------------
    private static string? FindScraper(string dataFolder)
    {
        foreach (var c in new[]
        {
            Path.Combine(AppContext.BaseDirectory, "scraper", "scrape.js"),
            Path.Combine(AppContext.BaseDirectory, "..", "scraper", "scrape.js"),
            Path.Combine(dataFolder ?? "", "scraper", "scrape.js"),
        })
        {
            try { if (File.Exists(c)) return Path.GetFullPath(c); } catch { /* ignore */ }
        }
        return null;
    }

    private static string JsonEsc(string s) => s.Replace("\\", "\\\\").Replace("\"", "\\\"");

    private async void BotStart_Click(object sender, RoutedEventArgs e)
    {
        SaveFromUi();
        if (_botProc != null && !_botProc.HasExited) { SetStatus("warn", "The bot is already running."); return; }
        if (string.IsNullOrWhiteSpace(_settings.DataFolder)) { SetStatus("warn", "Pick a data folder first."); return; }
        var scrape = FindScraper(_settings.DataFolder);
        if (scrape == null) { SetStatus("error", "Could not find scraper/scrape.js (expected next to the app or in the data folder)."); return; }
        string scraperDir = Path.GetDirectoryName(scrape)!;

        string auth = (BotAuthBox.SelectedItem as ComboBoxItem)?.Content?.ToString() == "Microsoft" ? "microsoft" : "offline";
        int count = Math.Max(1, ParsePort(BotCountBox.Text, 1));
        var accounts = new System.Text.StringBuilder();
        for (int i = 0; i < count; i++)
        {
            if (i > 0) accounts.Append(',');
            string user = BotUserBox.Text.Trim();
            if (string.IsNullOrEmpty(user)) user = "Scraper";
            if (count > 1) user += (i + 1);
            accounts.Append($"{{\"auth\":\"{auth}\",\"username\":\"{JsonEsc(user)}\"}}");
        }

        var cfg = new System.Text.StringBuilder();
        cfg.Append('{');
        cfg.Append("\"host\":\"127.0.0.1\",\"port\":").Append(_settings.ProxyPort).Append(',');
        cfg.Append("\"accounts\":[").Append(accounts).Append("],");
        cfg.Append("\"centerOnSpawn\":").Append(BotCenterOnSpawn.IsChecked == true ? "true" : "false").Append(',');
        cfg.Append("\"radius\":").Append(ParsePort(BotRadiusBox.Text, 256)).Append(',');
        cfg.Append("\"preferFly\":").Append(BotPreferFly.IsChecked == true ? "true" : "false").Append(',');
        cfg.Append("\"revisit\":").Append(BotRevisit.IsChecked == true ? "true" : "false").Append(',');
        if (!string.IsNullOrWhiteSpace(BotLoginPwBox.Text))
            cfg.Append("\"loginPassword\":\"").Append(JsonEsc(BotLoginPwBox.Text.Trim())).Append("\",");
        cfg.Append("\"visitedFile\":\"")
           .Append(JsonEsc(Path.Combine(_settings.DataFolder, "bot-visited.json").Replace("\\", "/")))
           .Append("\"}");
        string cfgPath = Path.Combine(scraperDir, "ui-config.json");
        try { File.WriteAllText(cfgPath, cfg.ToString()); }
        catch (Exception ex) { SetStatus("error", "Could not write bot config: " + ex.Message); return; }

        Busying(true);
        BotStartBtn.IsEnabled = false; BotStopBtn.IsEnabled = true;
        try
        {
            if (!Directory.Exists(Path.Combine(scraperDir, "node_modules")))
            {
                AppendLog("Installing bot dependencies (first run, this may take a minute)...");
                await RunToExitAsync(new[] { "npm.cmd", "npm" }, new[] { "install", "--no-audit", "--no-fund" }, scraperDir);
            }
            AppendLog("Starting bot...");
            _botProc = StartProc(new[] { "node", "node.exe" }, new[] { scrape, "--config", cfgPath }, scraperDir);
            if (_botProc == null)
            {
                SetStatus("error", "Node.js not found on PATH. Install Node.js to run the bot.");
                BotStartBtn.IsEnabled = true; BotStopBtn.IsEnabled = false;
            }
            else
            {
                _botProc.EnableRaisingEvents = true;
                _botProc.Exited += (_, _) => Dispatcher.Invoke(() =>
                {
                    AppendLog("Bot process exited.");
                    BotStartBtn.IsEnabled = true; BotStopBtn.IsEnabled = false; _botProc = null;
                });
                SetStatus("success", "Bot started — exploring through the proxy. Watch the output below.");
            }
        }
        catch (Exception ex) { SetStatus("error", "Could not start the bot: " + ex.Message); BotStartBtn.IsEnabled = true; BotStopBtn.IsEnabled = false; }
        finally { Busying(false); }
    }

    private void BotStop_Click(object sender, RoutedEventArgs e)
    {
        try { if (_botProc != null && !_botProc.HasExited) _botProc.Kill(true); } catch { /* ignore */ }
        _botProc = null;
        BotStartBtn.IsEnabled = true; BotStopBtn.IsEnabled = false;
        AppendLog("Bot stopped.");
    }

    /// <summary>Start a process, trying each exe candidate (e.g. node/node.exe, npm.cmd/npm), streaming output to the log.</summary>
    private Process? StartProc(string[] exeCandidates, string[] args, string cwd)
    {
        foreach (var exe in exeCandidates)
        {
            var psi = new ProcessStartInfo(exe)
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = cwd,
            };
            foreach (var a in args) psi.ArgumentList.Add(a);
            try
            {
                var p = Process.Start(psi)!;
                p.OutputDataReceived += (_, ev) => { if (ev.Data != null) AppendLog(ev.Data); };
                p.ErrorDataReceived += (_, ev) => { if (ev.Data != null) AppendLog(ev.Data); };
                p.BeginOutputReadLine();
                p.BeginErrorReadLine();
                return p;
            }
            catch { /* try next candidate */ }
        }
        return null;
    }

    private async Task RunToExitAsync(string[] exeCandidates, string[] args, string cwd)
    {
        var p = StartProc(exeCandidates, args, cwd);
        if (p == null) { AppendLog($"Could not run {exeCandidates[0]} (not found on PATH)."); return; }
        await p.WaitForExitAsync();
    }

    // ---- Global-memory preferences -------------------------------------------------------------
    private void InitializePreferences()
    {
        _loadingPreferences = true;
        ThemeBox.SelectedIndex = _settings.Theme switch { "Light" => 1, "High contrast" => 2, _ => 0 };
        LargeTextBox.IsChecked = _settings.LargeText;
        LanguageModeBox.SelectedIndex = _settings.LanguageMode switch { "Cantonese" => 1, "Bilingual" => 2, _ => 0 };
        EnglishFunnySlider.Value = _settings.EnglishFunnyLevel;
        CantoneseFunnySlider.Value = _settings.CantoneseFunnyLevel;
        DimSumCheck.IsChecked = _settings.DimSumSurpriseEnabled;
        UiFontBox.Text = _settings.UiFontFamily;
        UiFontScaleSlider.Value = _settings.UiFontScale;
        EditorPathBox.Text = string.IsNullOrWhiteSpace(_settings.ExternalEditorPath)
            ? DetectEditorPath() ?? ""
            : _settings.ExternalEditorPath;
        ApplyTheme(_settings.Theme);
        ApplyPreferencePreview();
        _loadingPreferences = false;
        FilterSettings();
        EvaluateRegexBuilder();
    }

    private void Preference_Changed(object sender, RoutedEventArgs e)
    {
        if (_loadingPreferences || LanguageModeBox is null) return;
        _settings.LanguageMode = LanguageModeBox.SelectedIndex switch { 1 => "Cantonese", 2 => "Bilingual", _ => "English" };
        _settings.EnglishFunnyLevel = (int)EnglishFunnySlider.Value;
        _settings.CantoneseFunnyLevel = (int)CantoneseFunnySlider.Value;
        _settings.DimSumSurpriseEnabled = DimSumCheck.IsChecked == true;
        _settings.UiFontFamily = string.IsNullOrWhiteSpace(UiFontBox.Text) ? "Segoe UI" : UiFontBox.Text.Trim();
        _settings.UiFontScale = UiFontScaleSlider.Value;
        _settings.ExternalEditorPath = EditorPathBox.Text.Trim();
        _settings.Save();
        ApplyPreferencePreview();
    }

    private void ApplyPreferencePreview()
    {
        try { FontFamily = new FontFamily(string.IsNullOrWhiteSpace(_settings.UiFontFamily) ? "Segoe UI" : _settings.UiFontFamily); }
        catch { FontFamily = new FontFamily("Segoe UI"); }
        var scale = _settings.UiFontScale * (_settings.LargeText ? 1.25 : 1.0);
        if (RootScale is not null) { RootScale.ScaleX = scale; RootScale.ScaleY = scale; }
        CopyPreviewText.Text = AppCopy.Get("settingsSaved", _settings.LanguageMode,
            _settings.EnglishFunnyLevel, _settings.CantoneseFunnyLevel);
    }

    private void ResetAppearance_Click(object sender, RoutedEventArgs e)
    {
        _loadingPreferences = true;
        _settings.Theme = "Dark";
        _settings.LargeText = false;
        _settings.UiFontFamily = "Segoe UI";
        _settings.UiFontScale = 1.0;
        ThemeBox.SelectedIndex = 0;
        LargeTextBox.IsChecked = false;
        UiFontBox.Text = _settings.UiFontFamily;
        UiFontScaleSlider.Value = 1.0;
        _settings.Save();
        ApplyTheme("Dark");
        ApplyPreferencePreview();
        _loadingPreferences = false;
        ShowToast("success", "Appearance reset", "Theme, font and size were restored to defaults.");
    }

    private bool _syncingSettingsSearch;

    private void SettingsSearch_Changed(object sender, TextChangedEventArgs e)
    {
        if (!_settingsSearchUsesRegex && !_syncingSettingsSearch && SettingsRegexPattern is not null)
        {
            _syncingSettingsSearch = true;
            SettingsRegexPattern.Text = RegexBuilderService.Literal(SettingsSearchBox.Text);
            _syncingSettingsSearch = false;
        }
        FilterSettings();
    }

    private void FilterSettings()
    {
        if (SettingsSearchBox is null) return;
        var query = SettingsSearchBox.Text.Trim();
        var cards = new[] { LanguageSettingsCard, AppearanceSettingsCard, EditorSettingsCard };
        int shown = 0;
        RegexEvaluation? validation = null;
        if (_settingsSearchUsesRegex)
            validation = RegexBuilderService.Evaluate(SettingsRegexPattern.Text, SettingsRegexFlags.Text, "");

        foreach (var card in cards)
        {
            var searchable = card.Tag?.ToString() ?? "";
            bool matches = string.IsNullOrEmpty(query);
            if (!matches && _settingsSearchUsesRegex)
            {
                var result = RegexBuilderService.Evaluate(SettingsRegexPattern.Text, SettingsRegexFlags.Text, searchable);
                validation = result;
                matches = result.IsValid && result.Matches.Count > 0;
            }
            else if (!matches)
            {
                matches = searchable.Contains(query, StringComparison.CurrentCultureIgnoreCase);
            }
            card.Visibility = matches ? Visibility.Visible : Visibility.Collapsed;
            if (matches) shown++;
        }

        SettingsSearchFeedback.Text = validation is { IsValid: false }
            ? "Regex error: " + validation.Error
            : $"{shown} settings section{(shown == 1 ? "" : "s")} shown. Search is {(_settingsSearchUsesRegex ? "regex" : "plain text")}.";
    }

    private void SettingsRegex_Click(object sender, RoutedEventArgs e)
    {
        SettingsRegexPopup.IsOpen = true;
        SettingsRegexPattern.Focus();
    }

    private void SettingsRegexPopup_Closed(object sender, EventArgs e) => SettingsSearchBox.Focus();

    private void SettingsRegexPattern_Changed(object sender, TextChangedEventArgs e)
    {
        if (SettingsRegexFeedback is null || SettingsRegexPattern is null || SettingsRegexFlags is null || _syncingSettingsSearch) return;
        var result = RegexBuilderService.Evaluate(SettingsRegexPattern.Text, SettingsRegexFlags.Text,
            "language appearance external editor dim sum");
        SettingsRegexFeedback.Text = result.IsValid
            ? $"Valid .NET pattern · {result.Matches.Count} preview match(es)."
            : "Regex error: " + result.Error;
        if (_settingsSearchUsesRegex) FilterSettings();
    }

    private void SettingsRegexLiteral_Click(object sender, RoutedEventArgs e) =>
        SettingsRegexPattern.Text = RegexBuilderService.Literal(SettingsRegexPattern.Text);
    private void SettingsRegexGroup_Click(object sender, RoutedEventArgs e) =>
        SettingsRegexPattern.Text = RegexBuilderService.Group(SettingsRegexPattern.Text);
    private void SettingsRegexAnchor_Click(object sender, RoutedEventArgs e) =>
        SettingsRegexPattern.Text = RegexBuilderService.Anchored(SettingsRegexPattern.Text);

    private void SettingsRegexApply_Click(object sender, RoutedEventArgs e)
    {
        var result = RegexBuilderService.Evaluate(SettingsRegexPattern.Text, SettingsRegexFlags.Text, "settings");
        if (!result.IsValid) { SettingsRegexFeedback.Text = "Regex error: " + result.Error; return; }
        _settingsSearchUsesRegex = true;
        _syncingSettingsSearch = true;
        SettingsSearchBox.Text = SettingsRegexPattern.Text;
        _syncingSettingsSearch = false;
        SettingsRegexPopup.IsOpen = false;
        FilterSettings();
    }

    // ---- Full regex builder -------------------------------------------------------------------
    private void RegexInput_Changed(object sender, TextChangedEventArgs e) => EvaluateRegexBuilder();

    private void EvaluateRegexBuilder()
    {
        // TextChanged fires while InitializeComponent is still creating the controls. Do not
        // evaluate until the whole builder exists; this guard prevents an early-startup crash.
        if (RegexPatternBox is null || RegexFlagsBox is null || RegexSampleBox is null ||
            RegexFeedbackText is null || RegexResultsBox is null || _settings is null) return;
        var result = RegexBuilderService.Evaluate(RegexPatternBox.Text, RegexFlagsBox.Text, RegexSampleBox.Text);
        if (!result.IsValid)
        {
            RegexFeedbackText.Text = "Regex error: " + result.Error;
            RegexResultsBox.Text = "";
            return;
        }

        RegexFeedbackText.Text = result.Matches.Count == 0
            ? AppCopy.Get("regexNoMatch", _settings.LanguageMode, _settings.EnglishFunnyLevel, _settings.CantoneseFunnyLevel)
            : $"{result.Matches.Count} match(es); .NET regular expression dialect.";
        var output = new StringBuilder();
        foreach (var match in result.Matches)
        {
            output.AppendLine($"[{match.Index}..{match.Index + match.Length}] {match.Value}");
            foreach (var capture in match.Captures.Where(c => c.Group > 0))
                output.AppendLine($"  group {capture.Name}: [{capture.Index}..{capture.Index + capture.Length}] {capture.Value}");
        }
        RegexResultsBox.Text = output.ToString();
    }

    private void RegexLiteral_Click(object sender, RoutedEventArgs e) => RegexPatternBox.Text = RegexBuilderService.Literal(RegexPatternBox.Text);
    private void RegexClass_Click(object sender, RoutedEventArgs e) => RegexPatternBox.Text = RegexBuilderService.CharacterClass(RegexPatternBox.Text);
    private void RegexGroup_Click(object sender, RoutedEventArgs e) => RegexPatternBox.Text = RegexBuilderService.Group(RegexPatternBox.Text);
    private void RegexAlternate_Click(object sender, RoutedEventArgs e) => RegexPatternBox.Text += "|";
    private void RegexAnchor_Click(object sender, RoutedEventArgs e) => RegexPatternBox.Text = RegexBuilderService.Anchored(RegexPatternBox.Text);
    private void RegexQuantifier_Click(object sender, RoutedEventArgs e) => RegexPatternBox.Text = RegexBuilderService.Quantify(RegexPatternBox.Text, 1);

    private void CopyRegex_Click(object sender, RoutedEventArgs e)
    {
        try { Clipboard.SetText(RegexPatternBox.Text); ShowToast("success", "Pattern copied", "The .NET regex pattern was copied to the clipboard."); }
        catch (Exception ex) { ShowToast("error", "Copy failed", "The pattern was not copied: " + ex.Message); }
    }

    private void ExportRegex_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new Microsoft.Win32.SaveFileDialog { Filter = "Markdown (*.md)|*.md|Text (*.txt)|*.txt", FileName = "world-downloader-regex.md" };
        if (dialog.ShowDialog() != true) return;
        try
        {
            File.WriteAllText(dialog.FileName, $"# .NET regular expression\n\nFlags: `{RegexFlagsBox.Text}`\n\n```regex\n{RegexPatternBox.Text}\n```\n");
            ShowToast("success", "Pattern exported", "The current .NET regex and flags were exported to " + dialog.FileName);
        }
        catch (Exception ex) { ShowToast("error", "Export failed", "The pattern was not exported: " + ex.Message); }
    }

    // ---- External editor ----------------------------------------------------------------------
    private static string? DetectEditorPath()
    {
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var candidates = new[]
        {
            Path.Combine(local, "Programs", "Microsoft VS Code", "Code.exe"),
            Path.Combine(local, "Programs", "Microsoft VS Code Insiders", "Code - Insiders.exe"),
        };
        return candidates.FirstOrDefault(File.Exists);
    }

    private void BrowseEditor_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new Microsoft.Win32.OpenFileDialog { Filter = "Applications (*.exe)|*.exe|All files (*.*)|*.*", Title = "Choose an external editor" };
        if (dialog.ShowDialog() == true) EditorPathBox.Text = dialog.FileName;
    }

    private void OpenProjectEditor_Click(object sender, RoutedEventArgs e)
    {
        Preference_Changed(sender, e);
        if (string.IsNullOrWhiteSpace(_settings.ExternalEditorPath) || !File.Exists(_settings.ExternalEditorPath))
        {
            ShowToast("error", "Editor unavailable", "Choose an installed editor executable in Settings, then retry.");
            return;
        }
        var folder = FindBuildContext() ?? _settings.DataFolder;
        try
        {
            var start = new ProcessStartInfo(_settings.ExternalEditorPath) { UseShellExecute = false };
            start.ArgumentList.Add(folder);
            Process.Start(start);
            ShowToast("success", "Project opened", "The project folder was sent to the configured external editor.");
        }
        catch (Exception ex) { ShowToast("error", "Editor launch failed", "The project was not opened: " + ex.Message); }
    }

    // ---- One-percent local dim-sum delight ----------------------------------------------------
    private void MaybeShowDimSum()
    {
        if (!_settings.DimSumSurpriseEnabled) return;
        bool forcedForCapture = Environment.GetEnvironmentVariable("MWD_FORCE_DIM_SUM") == "1";
        if (!forcedForCapture && Random.Shared.NextDouble() >= 0.01) return;

        var dishes = new[]
        {
            (English: "Shrimp dumpling", Cantonese: "蝦餃", Asset: "har-gow.png"),
            (English: "Siu mai", Cantonese: "燒賣", Asset: "siu-mai.png"),
            (English: "Egg custard bun", Cantonese: "流沙包", Asset: "custard-bun.png"),
        };
        var dish = dishes[Random.Shared.Next(dishes.Length)];
        DimSumName.Text = _settings.LanguageMode switch
        {
            "Cantonese" => dish.Cantonese,
            "Bilingual" => $"{dish.English} · {dish.Cantonese}",
            _ => dish.English,
        };
        DimSumCopy.Text = AppCopy.Get("dimSumSurprise", _settings.LanguageMode,
            _settings.EnglishFunnyLevel, _settings.CantoneseFunnyLevel);
        DimSumImage.Source = new BitmapImage(new Uri($"pack://application:,,,/Assets/DimSum/{dish.Asset}"));
        System.Windows.Automation.AutomationProperties.SetName(DimSumImage, $"{dish.English} · {dish.Cantonese}");
        DimSumToast.Visibility = Visibility.Visible;
        _dimSumTimer.Stop();
        if (Environment.GetEnvironmentVariable("MWD_HEADLESS_QA") != "1") _dimSumTimer.Start();
    }
}
