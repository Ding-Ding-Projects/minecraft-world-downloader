using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace WorldDownloaderManager;

public partial class MainWindow : Window
{
    private Settings _settings;
    private readonly DockerService _docker = new();
    private readonly OrderedAsyncQueue _settingsMutationQueue = new();
    private Task<bool> _lastSettingsSaveTask = Task.FromResult(true);
    private readonly LocalHistoryService _history = new();
    private readonly SemaphoreSlim _historyGate = new(1, 1);
    private readonly OrderedAsyncQueue _historySnapshotQueue = new();
    private Task<bool> _lastHistorySnapshotTask = Task.FromResult(true);
    private readonly NotificationHistoryStore _notificationStore = new();
    private readonly SemaphoreSlim _notificationPersistenceGate = new(1, 1);
    private readonly OrderedAsyncQueue _notificationQueue = new();
    private BotRunContext? _botRun;
    private bool _loadingPreferences = true;
    private bool _settingsSearchUsesRegex;
    private bool _startupHealthy;
    private bool _loadingPasswordFields;
    private bool _consolePasswordEdited;
    private bool _botPasswordEdited;
    private bool _closingForDrain;
    private bool _closeAfterDrain;
    private readonly ObservableCollection<NotificationHistoryEntry> _notificationHistory = new();
    private readonly ObservableCollection<HistoryRevision> _historyRevisions = new();
    private readonly ObservableCollection<ChangelogRelease> _changelogReleases = new();
    private ChangelogService? _changelog;
    private ChangelogFilterResult? _currentChangelogFilter;
    private bool _syncingChangelogFilters;
    private readonly DispatcherTimer _toastTimer = new() { Interval = TimeSpan.FromSeconds(6) };
    private readonly DispatcherTimer _dimSumTimer = new() { Interval = TimeSpan.FromSeconds(8) };
    private readonly DispatcherTimer _preferenceSaveTimer = new() { Interval = TimeSpan.FromMilliseconds(650) };
    private readonly DispatcherTimer _changelogFilterTimer = new() { Interval = TimeSpan.FromMilliseconds(180) };
    private int _changelogFilterGeneration;
    private int _historySelectionGeneration;
    private string? _notificationLoadWarning;

    public MainWindow()
    {
        InitializeComponent();

        _settings = Settings.Load();
        _docker.OnOutput = AppendLog;
        LoadOperationalSettingsIntoUi();
        InitializePreferences();
        NotificationHistoryList.ItemsSource = _notificationHistory;
        HistoryRevisionList.ItemsSource = _historyRevisions;
        ChangelogReleaseList.ItemsSource = _changelogReleases;
        _changelogFilterTimer.Tick += (_, _) =>
        {
            _changelogFilterTimer.Stop();
            ApplyChangelogFilter();
        };
        InitializeChangelog();
        _toastTimer.Tick += (_, _) => { _toastTimer.Stop(); ToastBorder.Visibility = Visibility.Collapsed; };
        _dimSumTimer.Tick += (_, _) => { _dimSumTimer.Stop(); DimSumToast.Visibility = Visibility.Collapsed; };
        _preferenceSaveTimer.Tick += (_, _) =>
        {
            _preferenceSaveTimer.Stop();
            PersistSettings();
        };
        Closing += MainWindow_Closing;
        Closed += (_, _) =>
        {
            _preferenceSaveTimer.Stop();
            _changelogFilterTimer.Stop();
            _ = StopBotRun(updateUi: false);
        };

        Loaded += async (_, _) =>
        {
            await LoadNotificationHistoryAsync();
            if (_notificationLoadWarning is not null)
                ShowToast("warn", "Notification history needs attention", _notificationLoadWarning);
            await RecordInitialHistoryAsync();
            await InitAsync();
            if (_settings.HasCompletedFirstRun && _startupHealthy) MaybeShowDimSum();
            if (!_settings.HasCompletedFirstRun)
            {
                _settings.HasCompletedFirstRun = true;
                PersistSettings();
                ShowToast("info", "Voice settings are ready",
                    "Funny levels style every message, including errors and warnings, without changing the facts. Change or reset both language sliders in Settings at any time.");
            }
        };
    }

    private async void MainWindow_Closing(object? sender, CancelEventArgs e)
    {
        if (_closeAfterDrain) return;
        e.Cancel = true;
        if (_closingForDrain) return;

        _closingForDrain = true;
        _preferenceSaveTimer.Stop();
        _changelogFilterTimer.Stop();
        MainTabs.IsEnabled = false;
        var botCompletion = StopBotRun(updateUi: false);
        var readyToClose = false;

        try
        {
            try
            {
                await botCompletion.WaitAsync(TimeSpan.FromSeconds(15));
            }
            catch (TimeoutException)
            {
                ShowToast("error", "Bot is still stopping",
                    "The window stayed open because the bot process did not confirm exit within 15 seconds. Stop the process and close again.");
                return;
            }

            // Let any restore or earlier settings mutation finish before taking the final UI
            // snapshot; this prevents close from replaying pre-restore controls afterward.
            await _settingsMutationQueue.DrainAsync();
            ApplySettingsFromUi();
            var finalJson = _settings.ToJson();
            _lastSettingsSaveTask = _settingsMutationQueue.Enqueue(() => PersistSettingsSnapshotAsync(finalJson));
            if (!await _lastSettingsSaveTask)
                throw new IOException("The final settings snapshot could not be saved.");
            MarkPasswordInputsSaved();
            await _settingsMutationQueue.DrainAsync();

            await FlushHistoryQueueAsync();
            await FlushNotificationQueueAsync();
            readyToClose = true;
        }
        catch (Exception ex)
        {
            ShowToast("error", "Close is waiting for durable data",
                "The window stayed open because pending app data could not finish saving: " + ex.Message);
        }
        finally
        {
            if (readyToClose)
            try
            {
                _closeAfterDrain = true;
                Close();
            }
            catch
            {
                _closeAfterDrain = false;
                _closingForDrain = false;
                MainTabs.IsEnabled = true;
            }
            else
            {
                _closingForDrain = false;
                MainTabs.IsEnabled = true;
            }
        }
    }

    private void LoadOperationalSettingsIntoUi()
    {
        _loadingPasswordFields = true;
        try
        {
        FolderBox.Text = _settings.DataFolder;
        WebPortBox.Text = _settings.WebPort.ToString();
        ProxyPortBox.Text = _settings.ProxyPort.ToString();
        ExposeWebCheck.IsChecked = _settings.ExposeWebToLan;
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

        ServerJarBox.Text = _settings.ServerJarPath;
        BmThreads.Text = _settings.BlueMapThreads.ToString();
        BmPort.Text = _settings.BlueMapPort.ToString();
        BmOverworld.IsChecked = _settings.BlueMapOverworld;
        BmNether.IsChecked = _settings.BlueMapNether;
        BmEnd.IsChecked = _settings.BlueMapEnd;
        BotAuthBox.SelectedIndex = string.Equals(_settings.BotAuth, "microsoft", StringComparison.OrdinalIgnoreCase) ? 1 : 0;
        BotUserBox.Text = _settings.BotUsername;
        BotRadiusBox.Text = _settings.BotRadius.ToString();
        BotCountBox.Text = _settings.BotCount.ToString();
        BotLoginPwBox.Password = _settings.BotLoginPassword;
        BotCenterOnSpawn.IsChecked = _settings.BotCenterOnSpawn;
        BotPreferFly.IsChecked = _settings.BotPreferFly;
        BotRevisit.IsChecked = _settings.BotRevisit;

        if (_settings.IsPasswordUnreadable)
            ShowToast("error", "Console password needs attention",
                "Login remains enabled, but Windows could not decrypt the saved console password. Enter it again before starting.");
        if (_settings.IsBotLoginPasswordUnreadable)
            ShowToast("error", "Bot password needs attention",
                "Windows could not decrypt the saved bot login password. Enter it again before starting the bot.");
        }
        finally
        {
            _loadingPasswordFields = false;
            _consolePasswordEdited = false;
            _botPasswordEdited = false;
        }
    }

    private void SecretPassword_Changed(object sender, RoutedEventArgs e)
    {
        if (_loadingPasswordFields) return;
        if (ReferenceEquals(sender, PassBox)) _consolePasswordEdited = true;
        if (ReferenceEquals(sender, BotLoginPwBox)) _botPasswordEdited = true;
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

    private bool SaveFromUi()
    {
        ApplySettingsFromUi();
        var saved = PersistSettings();
        if (saved) MarkPasswordInputsSaved();
        return saved;
    }

    private void ApplySettingsFromUi()
    {
        _settings.DataFolder = FolderBox.Text.Trim();
        _settings.WebPort = ParsePort(WebPortBox.Text, 8080);
        _settings.ProxyPort = ParsePort(ProxyPortBox.Text, 25565);
        _settings.ExposeWebToLan = ExposeWebCheck.IsChecked == true;
        _settings.Server = ServerBox.Text.Trim();
        _settings.OutputDir = string.IsNullOrWhiteSpace(OutputDirBox.Text) ? "world" : OutputDirBox.Text.Trim();
        _settings.AutoStart = AutoStartCheck.IsChecked == true;
        if (!string.IsNullOrWhiteSpace(ImageBox.Text)) _settings.Image = ImageBox.Text.Trim();
        _settings.RequireLogin = LoginCheck.IsChecked == true;
        _settings.Username = UserBox.Text.Trim();
        _settings.UpdatePasswordFromInput(PassBox.Password, _consolePasswordEdited);
        _settings.BuildLocally = BuildLocalCheck.IsChecked == true;
        _settings.BuildContext = BuildContextBox.Text.Trim();

        _settings.ServerJarPath = ServerJarBox.Text.Trim();
        _settings.BlueMapThreads = Math.Max(0, ParseNonNegativeInt(BmThreads.Text, 0));
        _settings.BlueMapPort = ParsePort(BmPort.Text, 8100);
        _settings.BlueMapOverworld = BmOverworld.IsChecked == true;
        _settings.BlueMapNether = BmNether.IsChecked == true;
        _settings.BlueMapEnd = BmEnd.IsChecked == true;
        _settings.BotAuth = BotAuthBox.SelectedIndex == 1 ? "microsoft" : "offline";
        _settings.BotUsername = string.IsNullOrWhiteSpace(BotUserBox.Text) ? "Scraper" : BotUserBox.Text.Trim();
        _settings.BotRadius = Math.Max(1, ParseNonNegativeInt(BotRadiusBox.Text, 256));
        _settings.BotCount = Math.Max(1, ParseNonNegativeInt(BotCountBox.Text, 1));
        _settings.UpdateBotLoginPasswordFromInput(BotLoginPwBox.Password, _botPasswordEdited);
        _settings.BotCenterOnSpawn = BotCenterOnSpawn.IsChecked == true;
        _settings.BotPreferFly = BotPreferFly.IsChecked == true;
        _settings.BotRevisit = BotRevisit.IsChecked == true;
    }

    private void MarkPasswordInputsSaved()
    {
        _consolePasswordEdited = false;
        _botPasswordEdited = false;
    }

    private static int ParseNonNegativeInt(string text, int fallback) =>
        int.TryParse(text, out var value) && value >= 0 ? value : fallback;

    private bool PersistSettings()
    {
        var json = _settings.ToJson();
        _lastSettingsSaveTask = _settingsMutationQueue.Enqueue(() => PersistSettingsSnapshotAsync(json));
        return true;
    }

    private async Task<bool> PersistSettingsSnapshotAsync(string json)
    {
        try
        {
            var snapshot = Settings.FromJson(json);
            var saveResult = await Task.Run(() =>
            {
                var saved = snapshot.TrySave(out var error);
                return (saved, error);
            });
            if (!saveResult.saved)
            {
                ShowToast("error", "Settings were not saved",
                    "The requested change is still active for this session, but Windows could not save it: " + saveResult.error);
                return false;
            }

            // The settings write is the requested operation; append-only history follows on its
            // own ordered queue and can never roll back that primary action.
            _lastHistorySnapshotTask = QueueHistorySnapshot(snapshot.ToJson(), initial: false);
            return true;
        }
        catch (Exception ex)
        {
            ShowToast("error", "Settings were not saved",
                "The requested change is still active for this session, but Windows could not save it: " + ex.Message);
            return false;
        }
    }

    private Task<bool> QueueHistorySnapshot(string json, bool initial)
        => _historySnapshotQueue.Enqueue(() => RecordHistorySnapshotAsync(json, initial));

    private async Task RecordInitialHistoryAsync() =>
        await QueueHistorySnapshot(_settings.ToJson(), initial: true);

    private async Task<bool> RecordHistorySnapshotAsync(string json, bool initial)
    {
        await _historyGate.WaitAsync();
        try
        {
            var revisions = await Task.Run(() =>
            {
                _history.RecordSettingsSnapshot(json);
                return _history.GetRevisions().ToArray();
            });
            ApplyHistoryRevisions(revisions);
            return true;
        }
        catch (Exception ex)
        {
            ShowToast("warn", initial ? "Local history is unavailable" : "Local history was not updated",
                initial
                    ? "The app can continue, but settings revisions cannot be recorded: " + ex.Message
                    : "Your settings were saved, but the local revision could not be recorded: " + ex.Message);
            return false;
        }
        finally
        {
            _historyGate.Release();
        }
    }

    private void ApplyHistoryRevisions(IReadOnlyList<HistoryRevision> revisions)
    {
        var selectedSha = (HistoryRevisionList.SelectedItem as HistoryRevision)?.Sha;
        _historyRevisions.Clear();
        foreach (var revision in revisions) _historyRevisions.Add(revision);
        HistoryEmptyText.Visibility = revisions.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
        if (selectedSha is not null)
            HistoryRevisionList.SelectedItem = _historyRevisions.FirstOrDefault(item => item.Sha == selectedSha);
        if (HistoryRevisionList.SelectedItem is null && _historyRevisions.Count > 0)
            HistoryRevisionList.SelectedIndex = 0;
    }

    private async Task FlushHistoryQueueAsync()
        => await _historySnapshotQueue.DrainAsync();

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
        var entry = new NotificationHistoryEntry(Guid.NewGuid(), DateTimeOffset.Now, kind, title, body);
        _ = EnqueueNotificationOperation(() => PersistNotificationAsync(entry));
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

    internal void ReportUnhandledError(string source, string message, string logPath) =>
        Dispatcher.Invoke(() => ShowToast("error", "World Downloader hit an error",
            $"The {source} path reported: {message}. Details were saved to {logPath}"));

    private void DismissToast_Click(object sender, RoutedEventArgs e)
    {
        _toastTimer.Stop();
        ToastBorder.Visibility = Visibility.Collapsed;
    }

    private void ReplaceNotificationHistory(IEnumerable<NotificationHistoryEntry> items)
    {
        _notificationHistory.Clear();
        foreach (var item in items) _notificationHistory.Add(item);
    }

    private Task EnqueueNotificationOperation(Func<Task> operation)
        => _notificationQueue.Enqueue(operation);

    private Task LoadNotificationHistoryAsync() =>
        EnqueueNotificationOperation(LoadNotificationHistoryCoreAsync);

    private async Task LoadNotificationHistoryCoreAsync()
    {
        await _notificationPersistenceGate.WaitAsync();
        try
        {
            var loaded = await Task.Run(_notificationStore.Load);
            ReplaceNotificationHistory(loaded.Items);
            _notificationLoadWarning = loaded.Warning;
        }
        catch
        {
            _notificationLoadWarning =
                "Notification history could not be loaded. The app can continue and the existing file was left unchanged.";
        }
        finally
        {
            _notificationPersistenceGate.Release();
        }
    }

    private async Task PersistNotificationAsync(NotificationHistoryEntry entry)
    {
        await _notificationPersistenceGate.WaitAsync();
        try
        {
            var saved = await Task.Run(() => _notificationStore.Add(entry));
            if (saved.Succeeded)
            {
                ReplaceNotificationHistory(saved.Items);
            }
            else
            {
                InsertNotificationFallback(entry);
                AppendLog(saved.Error ?? "Notification history could not be saved.");
            }
        }
        catch (Exception ex)
        {
            InsertNotificationFallback(entry);
            AppendLog("Notification history could not be saved: " + ex.Message);
        }
        finally
        {
            _notificationPersistenceGate.Release();
        }
    }

    private void InsertNotificationFallback(NotificationHistoryEntry entry)
    {
        var existing = _notificationHistory.FirstOrDefault(item => item.Id == entry.Id);
        if (existing is not null) _notificationHistory.Remove(existing);
        _notificationHistory.Insert(0, entry);
        while (_notificationHistory.Count > NotificationHistoryStore.MaximumEntries)
            _notificationHistory.RemoveAt(_notificationHistory.Count - 1);
    }

    private async void ClearNotifications_Click(object sender, RoutedEventArgs e)
        => await EnqueueNotificationOperation(ClearNotificationsCoreAsync);

    private async Task ClearNotificationsCoreAsync()
    {
        await _notificationPersistenceGate.WaitAsync();
        try
        {
            var result = await Task.Run(_notificationStore.Clear);
            if (result.Succeeded)
                ReplaceNotificationHistory(result.Items);
            else
                ShowToast("error", "Notification history was not cleared", result.Error ?? "The persisted history could not be updated.");
        }
        catch (Exception ex)
        {
            ShowToast("error", "Notification history was not cleared", ex.Message);
        }
        finally
        {
            _notificationPersistenceGate.Release();
        }
    }

    private async Task FlushNotificationQueueAsync()
        => await _notificationQueue.DrainAsync();

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

    private void Login_Changed(object sender, RoutedEventArgs e)
    {
        bool enabled = LoginCheck.IsChecked == true;
        LoginPanel.Visibility = enabled ? Visibility.Visible : Visibility.Collapsed;
        if (ExposeWebCheck is not null)
        {
            ExposeWebCheck.IsEnabled = enabled;
            if (!enabled) ExposeWebCheck.IsChecked = false;
        }
    }

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

        try
        {
            _ = DockerService.BuildRunArguments(_settings);
        }
        catch (InvalidOperationException ex)
        {
            SetStatus("error", ex.Message);
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
        var name = ThemeBox.SelectedIndex switch { 1 => "Light", 2 => "High contrast", _ => "Dark" };
        ApplyTheme(name);
        if (!_loadingPreferences)
        {
            _settings.Theme = name;
            PersistSettings();
        }
    }

    private void LargeText_Changed(object sender, RoutedEventArgs e)
    {
        if (_settings is null) return;
        _settings.LargeText = LargeTextBox.IsChecked == true;
        ApplyPreferencePreview();
        if (!_loadingPreferences)
            PersistSettings();
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

        // Honour the same output directory that the downloader receives.
        string world = Path.Combine(_settings.DataFolder,
            string.IsNullOrWhiteSpace(_settings.OutputDir) ? "world" : _settings.OutputDir);
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

    private async void BotStart_Click(object sender, RoutedEventArgs e)
    {
        SaveFromUi();
        if (Volatile.Read(ref _botRun) is not null) { SetStatus("warn", "The bot is already starting or running."); return; }
        if (string.IsNullOrWhiteSpace(_settings.DataFolder)) { SetStatus("warn", "Pick a data folder first."); return; }
        var scrape = FindScraper(_settings.DataFolder);
        if (scrape == null) { SetStatus("error", "Could not find scraper/scrape.js (expected next to the app or in the data folder)."); return; }
        string scraperDir = Path.GetDirectoryName(scrape)!;
        if (_settings.IsBotLoginPasswordUnreadable)
        {
            SetStatus("error", "The saved bot login password cannot be decrypted. Enter it again before starting the bot.");
            return;
        }

        var run = new BotRunContext();
        if (Interlocked.CompareExchange(ref _botRun, run, null) is not null)
        {
            run.Dispose();
            SetStatus("warn", "The bot is already starting or running.");
            return;
        }

        bool botStarted = false;
        Busying(true);
        BotStartBtn.IsEnabled = false; BotStopBtn.IsEnabled = true;
        try
        {
            if (!Directory.Exists(Path.Combine(scraperDir, "node_modules")))
            {
                AppendLog("Installing bot dependencies (first run, this may take a minute)...");
                await RunToExitAsync(new[] { "npm.cmd", "npm" }, new[] { "install", "--no-audit", "--no-fund" }, scraperDir, run);
            }

            run.CancellationToken.ThrowIfCancellationRequested();
            var configPath = run.TryCreateConfig(() => EphemeralBotConfig.Create(BuildBotConfig()));
            if (configPath is null) throw new OperationCanceledException(run.CancellationToken);

            run.CancellationToken.ThrowIfCancellationRequested();
            AppendLog("Starting bot...");
            var process = run.TryStartProcess(() =>
                StartProc(new[] { "node", "node.exe" }, new[] { scrape, "--config", configPath }, scraperDir, run));
            if (process == null)
            {
                run.CancellationToken.ThrowIfCancellationRequested();
                if (IsCurrentBotRun(run))
                    SetStatus("error", "Node.js not found on PATH. Install Node.js to run the bot.");
            }
            else
            {
                process.Exited += (_, _) => QueueBotExit(run);
                process.EnableRaisingEvents = true;
                if (process.HasExited) QueueBotExit(run);
                botStarted = true;
                if (IsCurrentBotRun(run))
                    SetStatus("success", "Bot started — exploring through the proxy. Watch the output below.");
            }
        }
        catch (OperationCanceledException) when (run.IsCancellationRequested) { }
        catch (Exception ex)
        {
            if (IsCurrentBotRun(run))
                SetStatus("error", "Could not start the bot: " + ex.Message);
        }
        finally
        {
            if (!botStarted)
            {
                bool wasCurrent = ReferenceEquals(Interlocked.CompareExchange(ref _botRun, null, run), run);
                run.Dispose();
                if (wasCurrent)
                {
                    BotStartBtn.IsEnabled = true;
                    BotStopBtn.IsEnabled = false;
                    Busying(false);
                }
            }
            else if (IsCurrentBotRun(run))
            {
                Busying(false);
            }
        }
    }

    private Dictionary<string, object?> BuildBotConfig()
    {
        var accounts = new List<Dictionary<string, object?>>(_settings.BotCount);
        for (int i = 0; i < _settings.BotCount; i++)
        {
            string user = BotUserBox.Text.Trim();
            if (string.IsNullOrEmpty(user)) user = "Scraper";
            if (_settings.BotCount > 1) user += (i + 1);
            accounts.Add(new Dictionary<string, object?>
            {
                ["auth"] = _settings.BotAuth,
                ["username"] = user,
            });
        }

        var config = new Dictionary<string, object?>
        {
            ["host"] = "127.0.0.1",
            ["port"] = _settings.ProxyPort,
            ["accounts"] = accounts,
            ["centerOnSpawn"] = _settings.BotCenterOnSpawn,
            ["radius"] = _settings.BotRadius,
            ["preferFly"] = _settings.BotPreferFly,
            ["revisit"] = _settings.BotRevisit,
            ["visitedFile"] = Path.Combine(_settings.DataFolder, "bot-visited.json").Replace("\\", "/"),
        };
        if (_settings.TryGetBotLoginPassword(out var botPassword) && !string.IsNullOrWhiteSpace(botPassword))
            config["loginPassword"] = botPassword;
        return config;
    }

    private bool IsCurrentBotRun(BotRunContext run) =>
        ReferenceEquals(Volatile.Read(ref _botRun), run);

    private void QueueBotExit(BotRunContext run)
    {
        if (!run.TryBeginExitHandling()) return;
        try { Dispatcher.BeginInvoke(() => HandleBotExit(run)); }
        catch
        {
            Interlocked.CompareExchange(ref _botRun, null, run);
            run.Dispose();
        }
    }

    private void HandleBotExit(BotRunContext run)
    {
        bool wasCurrent = ReferenceEquals(Interlocked.CompareExchange(ref _botRun, null, run), run);
        run.Dispose();
        if (!wasCurrent) return;
        AppendLog("Bot process exited.");
        BotStartBtn.IsEnabled = true;
        BotStopBtn.IsEnabled = false;
    }

    private void BotStop_Click(object sender, RoutedEventArgs e) => _ = StopBotRun(updateUi: true);

    private Task StopBotRun(bool updateUi)
    {
        var run = Volatile.Read(ref _botRun);
        run?.Cancel();
        var completion = run?.Completion ?? Task.CompletedTask;
        if (!updateUi) return completion;

        Busying(false);
        BotStartBtn.IsEnabled = run is null;
        BotStopBtn.IsEnabled = run is not null;
        AppendLog(run is null ? "The bot is not running." : "Bot stop requested; waiting for confirmed process exit.");
        return completion;
    }

    /// <summary>Start a process, trying each exe candidate (e.g. node/node.exe, npm.cmd/npm), streaming output to the log.</summary>
    private Process? StartProc(string[] exeCandidates, string[] args, string cwd, BotRunContext? owner = null)
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
                p.OutputDataReceived += (_, ev) =>
                {
                    if (ev.Data != null && (owner is null || IsCurrentBotRun(owner))) AppendLog(ev.Data);
                };
                p.ErrorDataReceived += (_, ev) =>
                {
                    if (ev.Data != null && (owner is null || IsCurrentBotRun(owner))) AppendLog(ev.Data);
                };
                p.BeginOutputReadLine();
                p.BeginErrorReadLine();
                return p;
            }
            catch { /* try next candidate */ }
        }
        return null;
    }

    private async Task RunToExitAsync(string[] exeCandidates, string[] args, string cwd, BotRunContext run)
    {
        var p = run.TryStartProcess(() => StartProc(exeCandidates, args, cwd, run));
        if (p == null)
        {
            run.CancellationToken.ThrowIfCancellationRequested();
            throw new InvalidOperationException($"Could not run {exeCandidates[0]} (not found on PATH).");
        }

        int exitCode;
        try
        {
            await p.WaitForExitAsync(run.CancellationToken);
            exitCode = p.ExitCode;
        }
        finally { run.ReleaseProcess(p); }
        run.CancellationToken.ThrowIfCancellationRequested();
        if (exitCode != 0)
            throw new InvalidOperationException($"{exeCandidates[0]} exited with code {exitCode}.");
    }

    // ---- Offline factual changelog ------------------------------------------------------------
    private void InitializeChangelog()
    {
        try
        {
            _changelog = ChangelogService.LoadEmbedded();
            ApplyChangelogFilter();
        }
        catch (Exception ex)
        {
            ChangelogDateFeedback.Text = "The embedded changelog could not be loaded: " + ex.Message;
            ChangelogSearchBox.IsEnabled = false;
        }
    }

    private void ChangelogFilter_Changed(object sender, RoutedEventArgs e)
    {
        if (_syncingChangelogFilters || _changelog is null || ChangelogSearchBox is null) return;
        if (ReferenceEquals(sender, ChangelogRegexModeCheck) && ChangelogRegexPattern is not null)
        {
            _syncingChangelogFilters = true;
            if (ChangelogRegexModeCheck.IsChecked == true)
                ChangelogSearchBox.Text = RegexBuilderService.Literal(ChangelogSearchBox.Text);
            ChangelogRegexPattern.Text = ChangelogRegexModeCheck.IsChecked == true
                ? ChangelogSearchBox.Text
                : RegexBuilderService.Literal(ChangelogSearchBox.Text);
            _syncingChangelogFilters = false;
        }
        if (ReferenceEquals(sender, ChangelogSearchBox) && ChangelogRegexPattern is not null)
        {
            _syncingChangelogFilters = true;
            ChangelogRegexPattern.Text = ChangelogRegexModeCheck.IsChecked == true
                ? ChangelogSearchBox.Text
                : RegexBuilderService.Literal(ChangelogSearchBox.Text);
            _syncingChangelogFilters = false;
        }
        ScheduleChangelogFilter();
    }

    private async void ApplyChangelogFilter()
    {
        if (_changelog is null || ChangelogStartBox is null) return;
        _changelogFilterTimer.Stop();
        var generation = ++_changelogFilterGeneration;
        _currentChangelogFilter = null;
        SetChangelogExportAvailability(false);
        var start = ChangelogService.ParseOptionalTypedDate(ChangelogStartBox.Text);
        var end = ChangelogService.ParseOptionalTypedDate(ChangelogEndBox.Text);
        if (!start.IsValid || !end.IsValid)
        {
            InvalidateChangelogFilter(!start.IsValid ? start.Error : end.Error, null);
            return;
        }

        var range = new ChangelogDateRange(start.Value, end.Value);
        var options = new ChangelogFilterOptions(
            range,
            ChangelogSearchBox.Text,
            ChangelogRegexModeCheck.IsChecked == true,
            ChangelogRegexFlags?.Text ?? "i");
        ChangelogSearchFeedback.Text = "Filtering release text…";
        ChangelogFilterResult result;
        try
        {
            var changelog = _changelog!;
            result = await Task.Run(() => changelog.Filter(options));
        }
        catch (Exception ex)
        {
            if (generation == _changelogFilterGeneration)
                InvalidateChangelogFilter(null, "Filter error: " + ex.Message);
            return;
        }
        if (generation != _changelogFilterGeneration) return;
        if (!result.IsValid)
        {
            InvalidateChangelogFilter(null, "Filter error: " + result.Error);
            return;
        }

        _currentChangelogFilter = result;
        var selectedTag = (ChangelogReleaseList.SelectedItem as ChangelogRelease)?.Tag;
        _changelogReleases.Clear();
        foreach (var release in result.Releases) _changelogReleases.Add(release);
        ChangelogDateFeedback.Text = "Showing " + result.DateRange.ToIsoDescription() + ".";
        ChangelogSearchFeedback.Text =
            $"{result.Releases.Count} release{(result.Releases.Count == 1 ? "" : "s")} shown. Search is {(result.UsesRegex ? ".NET regex" : "plain text")}.";
        ChangelogReleaseList.SelectedItem = selectedTag is null
            ? null
            : _changelogReleases.FirstOrDefault(item => item.Tag == selectedTag);
        if (ChangelogReleaseList.SelectedItem is null && _changelogReleases.Count > 0)
            ChangelogReleaseList.SelectedIndex = 0;
        if (_changelogReleases.Count == 0)
            ChangelogDetailBox.Text = "No releases match the active date and search filters.";
        SetChangelogExportAvailability(true);
    }

    private void MarkChangelogFilterPending()
    {
        _currentChangelogFilter = null;
        ++_changelogFilterGeneration;
        SetChangelogExportAvailability(false);
    }

    private void ScheduleChangelogFilter()
    {
        MarkChangelogFilterPending();
        _changelogFilterTimer.Stop();
        _changelogFilterTimer.Start();
    }

    private void InvalidateChangelogFilter(string? dateError, string? searchError)
    {
        _currentChangelogFilter = null;
        _changelogReleases.Clear();
        ChangelogReleaseList.SelectedItem = null;
        ChangelogDetailBox.Text = dateError ?? searchError ?? "The changelog filter is invalid.";
        ChangelogDateFeedback.Text = dateError ?? "";
        ChangelogSearchFeedback.Text = searchError ?? "";
        SetChangelogExportAvailability(false);
    }

    private void SetChangelogExportAvailability(bool filterIsValid)
    {
        ChangelogCopyFilteredBtn.IsEnabled = filterIsValid;
        ChangelogExportBtn.IsEnabled = filterIsValid;
        ChangelogCopySelectedBtn.IsEnabled = filterIsValid &&
                                              ChangelogReleaseList.SelectedItem is ChangelogRelease;
    }

    private void ChangelogPreset_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (_changelog is null || _syncingChangelogFilters || ChangelogPresetBox.SelectedItem is not ComboBoxItem item) return;
        ChangelogDatePreset preset = item.Tag?.ToString() switch
        {
            "30" => ChangelogDatePreset.Last30Days,
            "90" => ChangelogDatePreset.Last90Days,
            "365" => ChangelogDatePreset.Last365Days,
            _ => ChangelogDatePreset.AllTime,
        };
        var range = ChangelogService.RangeForPreset(preset, DateOnly.FromDateTime(DateTime.Today));
        _syncingChangelogFilters = true;
        ChangelogStartBox.Text = range.Start?.ToString("yyyy-MM-dd") ?? "";
        ChangelogEndBox.Text = range.End?.ToString("yyyy-MM-dd") ?? "";
        ChangelogCalendar.SelectedDates.Clear();
        if (range.Start is { } start && range.End is { } end)
        {
            ChangelogCalendar.DisplayDate = start.ToDateTime(TimeOnly.MinValue);
            ChangelogCalendar.SelectedDates.AddRange(
                start.ToDateTime(TimeOnly.MinValue), end.ToDateTime(TimeOnly.MinValue));
        }
        _syncingChangelogFilters = false;
        ApplyChangelogFilter();
    }

    private void ChangelogCalendar_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (_syncingChangelogFilters || ChangelogCalendar.SelectedDates.Count == 0) return;
        _syncingChangelogFilters = true;
        ChangelogStartBox.Text = DateOnly.FromDateTime(ChangelogCalendar.SelectedDates.First()).ToString("yyyy-MM-dd");
        ChangelogEndBox.Text = DateOnly.FromDateTime(ChangelogCalendar.SelectedDates.Last()).ToString("yyyy-MM-dd");
        ChangelogPresetBox.SelectedIndex = -1;
        _syncingChangelogFilters = false;
        ApplyChangelogFilter();
    }

    private void ChangelogSelection_Changed(object sender, SelectionChangedEventArgs e)
        => RenderSelectedChangelogRelease();

    private void RenderSelectedChangelogRelease()
    {
        if (_changelog is null || ChangelogDetailBox is null) return;
        ChangelogDetailBox.Text = ChangelogReleaseList.SelectedItem is ChangelogRelease release
            ? _changelog.ExportCurrentSelectionMarkdown(release, CurrentChangelogLanguage(),
                _settings.EnglishFunnyLevel, _settings.CantoneseFunnyLevel)
            : "Select a release to read its details.";
        ChangelogCopySelectedBtn.IsEnabled = _currentChangelogFilter is { IsValid: true } &&
                                              ChangelogReleaseList.SelectedItem is ChangelogRelease;
    }

    private ChangelogLanguage CurrentChangelogLanguage() => _settings.LanguageMode switch
    {
        "Cantonese" => ChangelogLanguage.Cantonese,
        "Bilingual" => ChangelogLanguage.Bilingual,
        _ => ChangelogLanguage.English,
    };

    private void ChangelogRegex_Click(object sender, RoutedEventArgs e)
    {
        _syncingChangelogFilters = true;
        ChangelogRegexPattern.Text = ChangelogRegexModeCheck.IsChecked == true
            ? ChangelogSearchBox.Text
            : RegexBuilderService.Literal(ChangelogSearchBox.Text);
        _syncingChangelogFilters = false;
        ChangelogRegexPopup.IsOpen = true;
        ChangelogRegexPattern.Focus();
        EvaluateChangelogRegex();
    }

    private void ChangelogRegexPopup_Closed(object sender, EventArgs e) => ChangelogSearchBox.Focus();

    private void ChangelogRegexInput_Changed(object sender, TextChangedEventArgs e)
    {
        if (_syncingChangelogFilters || ChangelogRegexPattern is null) return;
        if (ChangelogRegexModeCheck.IsChecked == true &&
            (ReferenceEquals(sender, ChangelogRegexPattern) || ReferenceEquals(sender, ChangelogRegexFlags)))
        {
            if (ReferenceEquals(sender, ChangelogRegexPattern))
            {
                _syncingChangelogFilters = true;
                ChangelogSearchBox.Text = ChangelogRegexPattern.Text;
                _syncingChangelogFilters = false;
            }
            ScheduleChangelogFilter();
        }
        EvaluateChangelogRegex();
    }

    private void EvaluateChangelogRegex()
    {
        if (ChangelogRegexPattern is null || ChangelogRegexFlags is null || ChangelogRegexSample is null) return;
        var result = RegexBuilderService.Evaluate(
            ChangelogRegexPattern.Text, ChangelogRegexFlags.Text, ChangelogRegexSample.Text);
        ChangelogRegexFeedback.Text = result.IsValid
            ? $"Valid .NET pattern · {result.Matches.Count} sample match{(result.Matches.Count == 1 ? "" : "es")}." +
              (result.IsTruncated ? " Results were truncated at the safe output limit." : "")
            : "Regex error: " + result.Error;
        if (!result.IsValid) { ChangelogRegexResults.Text = ""; return; }
        var output = new StringBuilder();
        foreach (var match in result.Matches)
        {
            output.AppendLine($"[{match.Index}..{match.Index + match.Length}] {match.Value}");
            foreach (var capture in match.Captures.Where(capture => capture.Group > 0))
                output.AppendLine($"  group {capture.Name}: [{capture.Index}..{capture.Index + capture.Length}] {capture.Value}");
        }
        if (result.IsTruncated)
            output.AppendLine("… Additional matches or captures were truncated at the safe output limit.");
        ChangelogRegexResults.Text = output.ToString();
    }

    private void ChangelogRegexLiteral_Click(object sender, RoutedEventArgs e) =>
        ChangelogRegexPattern.Text = RegexBuilderService.Literal(ChangelogRegexPattern.Text);
    private void ChangelogRegexClass_Click(object sender, RoutedEventArgs e) =>
        ChangelogRegexPattern.Text = RegexBuilderService.CharacterClass(ChangelogRegexPattern.Text);
    private void ChangelogRegexGroup_Click(object sender, RoutedEventArgs e) =>
        ChangelogRegexPattern.Text = RegexBuilderService.Group(ChangelogRegexPattern.Text);
    private void ChangelogRegexAlternate_Click(object sender, RoutedEventArgs e) => ChangelogRegexPattern.Text += "|";
    private void ChangelogRegexAnchor_Click(object sender, RoutedEventArgs e) =>
        ChangelogRegexPattern.Text = RegexBuilderService.Anchored(ChangelogRegexPattern.Text);
    private void ChangelogRegexQuantifier_Click(object sender, RoutedEventArgs e) =>
        ChangelogRegexPattern.Text = RegexBuilderService.Quantify(ChangelogRegexPattern.Text, 1);

    private void ChangelogRegexApply_Click(object sender, RoutedEventArgs e)
    {
        var result = RegexBuilderService.Evaluate(
            ChangelogRegexPattern.Text, ChangelogRegexFlags.Text, ChangelogRegexSample.Text);
        if (!result.IsValid) { ChangelogRegexFeedback.Text = "Regex error: " + result.Error; return; }
        _syncingChangelogFilters = true;
        ChangelogRegexModeCheck.IsChecked = true;
        ChangelogSearchBox.Text = ChangelogRegexPattern.Text;
        _syncingChangelogFilters = false;
        ChangelogRegexPopup.IsOpen = false;
        ApplyChangelogFilter();
    }

    private void ChangelogRegexCopy_Click(object sender, RoutedEventArgs e)
    {
        try { Clipboard.SetText(ChangelogRegexPattern.Text); ShowToast("success", "Pattern copied", "The changelog regex pattern was copied."); }
        catch (Exception ex) { ShowToast("error", "Copy failed", ex.Message); }
    }

    private void ChangelogRegexExport_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new Microsoft.Win32.SaveFileDialog { Filter = "Markdown (*.md)|*.md|Text (*.txt)|*.txt", FileName = "changelog-regex.md" };
        if (dialog.ShowDialog() != true) return;
        try
        {
            File.WriteAllText(dialog.FileName, $"# Changelog .NET regular expression\n\nFlags: `{ChangelogRegexFlags.Text}`\n\n```regex\n{ChangelogRegexPattern.Text}\n```\n");
            ShowToast("success", "Pattern exported", "The changelog regex pattern was exported.");
        }
        catch (Exception ex) { ShowToast("error", "Export failed", ex.Message); }
    }

    private void ChangelogCopySelected_Click(object sender, RoutedEventArgs e)
    {
        if (_changelog is null || ChangelogReleaseList.SelectedItem is not ChangelogRelease release)
        {
            ShowToast("warn", "Select a release", "Choose a release to copy.");
            return;
        }
        try
        {
            Clipboard.SetText(_changelog.ExportCurrentSelectionMarkdown(release, CurrentChangelogLanguage(),
                _settings.EnglishFunnyLevel, _settings.CantoneseFunnyLevel));
            ShowToast("success", "Release copied", "The selected release entry was copied.");
        }
        catch (Exception ex) { ShowToast("error", "Copy failed", ex.Message); }
    }

    private void ChangelogCopyFiltered_Click(object sender, RoutedEventArgs e)
    {
        if (_changelog is null || _currentChangelogFilter is not { IsValid: true } filtered) return;
        try
        {
            Clipboard.SetText(_changelog.ExportFilteredViewMarkdown(filtered, CurrentChangelogLanguage(),
                _settings.EnglishFunnyLevel, _settings.CantoneseFunnyLevel));
            ShowToast("success", "Filtered changelog copied", "The visible date-and-search result was copied.");
        }
        catch (Exception ex) { ShowToast("error", "Copy failed", ex.Message); }
    }

    private void ChangelogExport_Click(object sender, RoutedEventArgs e)
    {
        if (_changelog is null || _currentChangelogFilter is not { IsValid: true } filtered) return;
        var dialog = new Microsoft.Win32.SaveFileDialog { Filter = "Markdown (*.md)|*.md", FileName = "world-downloader-changelog.md" };
        if (dialog.ShowDialog() != true) return;
        try
        {
            File.WriteAllText(dialog.FileName,
                _changelog.ExportFilteredViewMarkdown(filtered, CurrentChangelogLanguage(),
                    _settings.EnglishFunnyLevel, _settings.CantoneseFunnyLevel), new UTF8Encoding(false));
            ShowToast("success", "Changelog exported", "The visible date-and-search result was exported to " + dialog.FileName);
        }
        catch (Exception ex) { ShowToast("error", "Export failed", ex.Message); }
    }

    // ---- Append-only local settings history --------------------------------------------------
    private async void HistorySelection_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (HistoryDiffBox is null || HistoryLabelBox is null) return;
        if (HistoryRevisionList.SelectedItem is not HistoryRevision revision)
        {
            ++_historySelectionGeneration;
            HistoryDiffBox.Text = "Select a revision to compare it with the current settings.";
            HistoryLabelBox.Text = "";
            return;
        }
        var generation = ++_historySelectionGeneration;
        var currentJson = _settings.ToJson();
        HistoryDiffBox.Text = "Loading revision comparison…";
        HistoryLabelBox.Text = revision.Label ?? "";
        await _historyGate.WaitAsync();
        try
        {
            var diff = await Task.Run(() => _history.DiffAgainst(revision.Sha, currentJson));
            if (generation == _historySelectionGeneration) HistoryDiffBox.Text = diff;
        }
        catch (Exception ex)
        {
            if (generation == _historySelectionGeneration)
                HistoryDiffBox.Text = "The revision could not be read: " + ex.Message;
        }
        finally
        {
            _historyGate.Release();
        }
    }

    private async void HistoryLabel_Click(object sender, RoutedEventArgs e)
    {
        if (HistoryRevisionList.SelectedItem is not HistoryRevision revision)
        {
            ShowToast("warn", "Select a revision", "Choose a revision before saving a label.");
            return;
        }
        await _historyGate.WaitAsync();
        try
        {
            var label = HistoryLabelBox.Text;
            var revisions = await Task.Run(() =>
            {
                _history.LabelRevision(revision.Sha, label);
                return _history.GetRevisions().ToArray();
            });
            ApplyHistoryRevisions(revisions);
            ShowToast("success", "Revision labeled", "The local revision label was saved.");
        }
        catch (Exception ex) { ShowToast("error", "Label was not saved", ex.Message); }
        finally { _historyGate.Release(); }
    }

    private async void HistoryRestore_Click(object sender, RoutedEventArgs e)
    {
        if (HistoryRevisionList.SelectedItem is not HistoryRevision revision)
        {
            ShowToast("warn", "Select a revision", "Choose a revision to restore.");
            return;
        }
        var decision = MessageBox.Show(
            $"Restore settings from {revision.DisplayName}?\n\nThe current state stays in history, and this restore is recorded as a new revision so it can also be undone.",
            "Restore local revision", MessageBoxButton.YesNo, MessageBoxImage.Warning);
        if (decision != MessageBoxResult.Yes) return;

        MainTabs.IsEnabled = false;
        _preferenceSaveTimer.Stop();
        ApplySettingsFromUi();
        var preRestoreJson = _settings.ToJson();
        try
        {
            await _settingsMutationQueue.Enqueue(() => RestoreRevisionCoreAsync(revision, preRestoreJson));
        }
        catch (Exception ex) { ShowToast("error", "Revision was not restored", ex.Message); }
        finally
        {
            if (!_closingForDrain) MainTabs.IsEnabled = true;
        }
    }

    private async Task RestoreRevisionCoreAsync(HistoryRevision revision, string preRestoreJson)
    {
        if (!await PersistSettingsSnapshotAsync(preRestoreJson))
        {
            ShowToast("error", "Revision was not restored",
                "The current settings could not be saved, so no restore was attempted.");
            return;
        }
        MarkPasswordInputsSaved();

        var preRestoreSnapshot = _lastHistorySnapshotTask;
        if (!await preRestoreSnapshot)
        {
            ShowToast("error", "Revision was not restored",
                "The current settings could not be verified in local history, so no restore was attempted.");
            return;
        }
        await FlushHistoryQueueAsync();
        await _historyGate.WaitAsync();
        try
        {
            var snapshot = await Task.Run(() => _history.GetSnapshot(revision.Sha));
            var restored = Settings.FromJson(snapshot);
            var saveResult = await Task.Run(() =>
            {
                var saved = restored.TrySave(out var error);
                return (saved, error);
            });
            if (!saveResult.saved)
            {
                ShowToast("error", "Revision was not restored",
                    "The live settings file could not be updated, so history was left unchanged: " + saveResult.error);
                return;
            }

            _settings = restored;
            LoadOperationalSettingsIntoUi();
            InitializePreferences();
            try
            {
                var revisions = await Task.Run(() =>
                {
                    _history.RestoreSettingsSnapshot(revision.Sha);
                    return _history.GetRevisions().ToArray();
                });
                ApplyHistoryRevisions(revisions);
                ShowToast("success", "Revision restored",
                    "The selected snapshot is active and the restore was recorded as a new local revision.");
            }
            catch (Exception ex)
            {
                ShowToast("warn", "Settings restored; history record failed",
                    "The selected settings are active, but the restore revision could not be recorded: " + ex.Message);
            }
        }
        finally
        {
            _historyGate.Release();
        }
    }

    private async void HistoryExportSnapshot_Click(object sender, RoutedEventArgs e)
    {
        if (HistoryRevisionList.SelectedItem is not HistoryRevision revision)
        {
            ShowToast("warn", "Select a revision", "Choose a revision to export.");
            return;
        }
        var dialog = new Microsoft.Win32.SaveFileDialog
        {
            Filter = "JSON (*.json)|*.json",
            FileName = $"world-downloader-settings-{revision.ShortSha}.json",
        };
        if (dialog.ShowDialog() != true) return;
        await _historyGate.WaitAsync();
        try
        {
            await Task.Run(() => _history.ExportSnapshot(revision.Sha, dialog.FileName));
            ShowToast("success", "Snapshot exported", "The encrypted settings snapshot was exported to " + dialog.FileName);
        }
        catch (Exception ex) { ShowToast("error", "Snapshot was not exported", ex.Message); }
        finally { _historyGate.Release(); }
    }

    private async void HistoryExportRepository_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new Microsoft.Win32.SaveFileDialog
        {
            Filter = "Zip archive (*.zip)|*.zip",
            FileName = "world-downloader-local-history.zip",
        };
        if (dialog.ShowDialog() != true) return;
        await _historyGate.WaitAsync();
        try
        {
            await Task.Run(() => _history.ExportRepository(dialog.FileName));
            ShowToast("success", "History exported", "The isolated local Git history was exported to " + dialog.FileName);
        }
        catch (Exception ex) { ShowToast("error", "History was not exported", ex.Message); }
        finally { _historyGate.Release(); }
    }

    private async void HistoryPrune_Click(object sender, RoutedEventArgs e)
    {
        if (!int.TryParse(HistoryPruneKeepBox.Text, out var keep) || keep is < 1 or > 5000)
        {
            ShowToast("error", "Retention value is invalid", "Enter a number from 1 through 5000.");
            return;
        }
        var decision = MessageBox.Show(
            $"Keep the newest {keep} settings revisions and remove older revisions from this isolated local history?\n\nExport the repository first if you may need the older revisions.",
            "Prune local history", MessageBoxButton.YesNo, MessageBoxImage.Warning);
        if (decision != MessageBoxResult.Yes) return;
        await _historyGate.WaitAsync();
        try
        {
            var result = await Task.Run(() =>
            {
                var removed = _history.PruneToLatest(keep);
                return (removed, revisions: _history.GetRevisions().ToArray());
            });
            ApplyHistoryRevisions(result.revisions);
            ShowToast("success", "History pruned", $"Removed {result.removed} old revision{(result.removed == 1 ? "" : "s")}; the newest {keep} remain available.");
        }
        catch (Exception ex) { ShowToast("error", "History was not pruned", ex.Message); }
        finally { _historyGate.Release(); }
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
        ApplyPreferencePreview();
        if (ChangelogReleaseList?.SelectedItem is ChangelogRelease) RenderSelectedChangelogRelease();
        _preferenceSaveTimer.Stop();
        _preferenceSaveTimer.Start();
    }

    private void ApplyPreferencePreview()
    {
        try { FontFamily = new FontFamily(string.IsNullOrWhiteSpace(_settings.UiFontFamily) ? "Segoe UI" : _settings.UiFontFamily); }
        catch { FontFamily = new FontFamily("Segoe UI"); }
        var scale = _settings.UiFontScale * (_settings.LargeText ? 1.25 : 1.0);
        FontSize = 13d * scale;
        Resources["BodyFontSize"] = 13d * scale;
        Resources["HeadingFontSize"] = 14d * scale;
        Resources["LabelFontSize"] = 12d * scale;
        Resources["DescriptionFontSize"] = 11.5d * scale;
        Resources["TitleFontSize"] = 22d * scale;
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
        PersistSettings();
        ApplyTheme("Dark");
        ApplyPreferencePreview();
        _loadingPreferences = false;
        ShowToast("success", "Appearance reset", "Theme, font and size were restored to defaults.");
    }

    private bool _syncingSettingsSearch;

    private void SettingsSearch_Changed(object sender, TextChangedEventArgs e)
    {
        if (!_syncingSettingsSearch && SettingsRegexPattern is not null)
        {
            _syncingSettingsSearch = true;
            SettingsRegexPattern.Text = _settingsSearchUsesRegex
                ? SettingsSearchBox.Text
                : RegexBuilderService.Literal(SettingsSearchBox.Text);
            _syncingSettingsSearch = false;
        }
        FilterSettings();
    }

    private void SettingsSearchMode_Changed(object sender, RoutedEventArgs e)
    {
        if (SettingsRegexModeCheck is null || SettingsRegexPattern is null) return;
        _settingsSearchUsesRegex = SettingsRegexModeCheck.IsChecked == true;
        _syncingSettingsSearch = true;
        if (_settingsSearchUsesRegex)
            SettingsSearchBox.Text = RegexBuilderService.Literal(SettingsSearchBox.Text);
        SettingsRegexPattern.Text = _settingsSearchUsesRegex
            ? SettingsSearchBox.Text
            : RegexBuilderService.Literal(SettingsSearchBox.Text);
        _syncingSettingsSearch = false;
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
            var searchable = BuildSettingsSearchText(card);
            bool matches = MatchesSettingsSearch(searchable, query, ref validation);
            card.Visibility = matches ? Visibility.Visible : Visibility.Collapsed;
            if (matches) shown++;
        }

        bool downloaderMatch = !string.IsNullOrEmpty(query) &&
            MatchesSettingsSearch(BuildDownloaderSettingsSearchText(), query, ref validation);

        SettingsSearchFeedback.Text = validation is { IsValid: false }
            ? "Regex error: " + validation.Error
            : $"{shown} settings section{(shown == 1 ? "" : "s")} shown. Search is {(_settingsSearchUsesRegex ? "regex" : "plain text")}." +
              (downloaderMatch ? " Matching connection, BlueMap, or bot settings are on the Downloader tab." : "");
    }

    private bool MatchesSettingsSearch(string searchable, string query, ref RegexEvaluation? validation)
    {
        if (string.IsNullOrEmpty(query)) return true;
        if (!_settingsSearchUsesRegex)
            return searchable.Contains(query, StringComparison.CurrentCultureIgnoreCase);
        var result = RegexBuilderService.Evaluate(SettingsRegexPattern.Text, SettingsRegexFlags.Text, searchable);
        validation = result;
        return result.IsValid && result.Matches.Count > 0;
    }

    private static string BuildSettingsSearchText(DependencyObject root)
    {
        var output = new StringBuilder();
        void Visit(DependencyObject node)
        {
            switch (node)
            {
                case TextBlock text when !string.IsNullOrWhiteSpace(text.Text): output.AppendLine(text.Text); break;
                case TextBox box when !string.IsNullOrWhiteSpace(box.Text): output.AppendLine(box.Text); break;
                case ContentControl content when content.Content is string value: output.AppendLine(value); break;
            }
            if (node is FrameworkElement element && element.Tag is string tag) output.AppendLine(tag);
            for (int index = 0; index < VisualTreeHelper.GetChildrenCount(node); index++)
                Visit(VisualTreeHelper.GetChild(node, index));
        }
        Visit(root);
        return output.ToString();
    }

    private string BuildDownloaderSettingsSearchText() => string.Join('\n', new[]
    {
        "data folder web console port Minecraft proxy port server address world output directory auto start Docker image build source console login username password local network LAN",
        _settings.DataFolder, _settings.WebPort.ToString(), _settings.ProxyPort.ToString(), _settings.Server,
        _settings.OutputDir, _settings.Image, _settings.Username,
        "BlueMap server jar threads port overworld nether end", _settings.ServerJarPath,
        _settings.BlueMapThreads.ToString(), _settings.BlueMapPort.ToString(),
        "bot auto explore account username radius count login password center spawn fly revisit",
        _settings.BotAuth, _settings.BotUsername, _settings.BotRadius.ToString(), _settings.BotCount.ToString(),
    });

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
        if (_settingsSearchUsesRegex && ReferenceEquals(sender, SettingsRegexPattern))
        {
            _syncingSettingsSearch = true;
            SettingsSearchBox.Text = SettingsRegexPattern.Text;
            _syncingSettingsSearch = false;
            FilterSettings();
        }
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
        SettingsRegexModeCheck.IsChecked = true;
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
            : $"{result.Matches.Count} match(es); .NET regular expression dialect." +
              (result.IsTruncated ? " Results were truncated at the safe output limit." : "");
        var output = new StringBuilder();
        foreach (var match in result.Matches)
        {
            output.AppendLine($"[{match.Index}..{match.Index + match.Length}] {match.Value}");
            foreach (var capture in match.Captures.Where(c => c.Group > 0))
                output.AppendLine($"  group {capture.Name}: [{capture.Index}..{capture.Index + capture.Length}] {capture.Value}");
        }
        if (result.IsTruncated)
            output.AppendLine("… Additional matches or captures were truncated at the safe output limit.");
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
