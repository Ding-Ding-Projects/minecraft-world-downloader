using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;

namespace WorldDownloaderManager;

public partial class MainWindow
{
    private const string TabDragDataFormat = "WorldDownloaderManager.TabId";
    private readonly Dictionary<string, TabItem> _mainTabItems = new(StringComparer.Ordinal);
    private TabWorkspaceService? _tabWorkspace;
    private TabClosePreview? _currentTabClosePreview;
    private bool _loadingTabWorkspace;
    private bool _tabPointerHandlersAttached;
    private Point _tabDragStart;
    private string? _draggedTabId;

    private sealed record TabGroupChoice(string? Id, string DisplayName)
    {
        public override string ToString() => DisplayName;
    }

    private void InitializeTabWorkspace()
    {
        if (MainTabs is null || _settings is null) return;
        _loadingTabWorkspace = true;
        try
        {
            _tabWorkspace = new TabWorkspaceService(_settings.TabWorkspace);
            _settings.TabWorkspace = _tabWorkspace.State;
            EnsureMainTabRegistry();
            ConfigureTabRegexBuilders();
            RefreshTabWorkspaceVisuals(reloadSearchControls: true);
        }
        finally
        {
            _loadingTabWorkspace = false;
        }

        RefreshTabSearchResults();
        RefreshTabClosePreview();
        Dispatcher.BeginInvoke(UpdateTabOverflowIndicator, DispatcherPriority.Loaded);
    }

    private void EnsureMainTabRegistry()
    {
        if (_mainTabItems.Count == 0)
        {
            _mainTabItems[AppTabCatalog.DownloaderId] = DownloaderTab;
            _mainTabItems[AppTabCatalog.SettingsId] = SettingsTab;
            _mainTabItems[AppTabCatalog.RegexBuilderId] = RegexBuilderTab;
            _mainTabItems[AppTabCatalog.ChangelogId] = ChangelogTab;
            _mainTabItems[AppTabCatalog.HistoryId] = HistoryTab;
            _mainTabItems[AppTabCatalog.NotificationsId] = NotificationsTab;
        }

        if (_tabPointerHandlersAttached) return;
        foreach (var tab in _mainTabItems.Values)
        {
            tab.PreviewMouseLeftButtonDown += MainTab_PreviewMouseLeftButtonDown;
            tab.PreviewMouseMove += MainTab_PreviewMouseMove;
            tab.PreviewMouseLeftButtonUp += MainTab_PreviewMouseLeftButtonUp;
            tab.LostMouseCapture += MainTab_LostMouseCapture;
        }
        _tabPointerHandlersAttached = true;
    }

    private void RefreshTabWorkspaceLanguage()
    {
        if (_tabWorkspace is null || _loadingTabWorkspace) return;
        ConfigureTabRegexBuilders();
        RefreshTabWorkspaceVisuals(reloadSearchControls: false);
        RefreshTabSearchResults();
        RefreshTabClosePreview();
    }

    private void ConfigureTabRegexBuilders()
    {
        if (CurrentTabRegexBuilder is null || _settings is null) return;
        CurrentTabRegexBuilder.Configure("Current-strip regex builder", "目前分頁列正則表達式建構器", _settings.LanguageMode);
        GroupTabRegexBuilder.Configure("Group-tab regex builder", "群組內分頁正則表達式建構器", _settings.LanguageMode);
        GroupNameRegexBuilder.Configure("Group-name regex builder", "群組名稱正則表達式建構器", _settings.LanguageMode);
        MasterTabRegexBuilder.Configure("All-tabs regex builder", "全部分頁正則表達式建構器", _settings.LanguageMode);
        TabCloseRegexBuilder.Configure("Bulk-close regex builder", "批量關閉正則表達式建構器", _settings.LanguageMode);
    }

    private void RefreshTabWorkspaceVisuals(bool reloadSearchControls)
    {
        if (_tabWorkspace is null) return;
        var wasLoading = _loadingTabWorkspace;
        _loadingTabWorkspace = true;
        try
        {
            _settings.TabWorkspace = _tabWorkspace.State;
            ReorderAndDecorateMainTabs();
            RebuildTabGroupChips();
            RefreshTabGroupSelectors();
            if (reloadSearchControls) LoadTabSearchControlsFromState();
            RefreshSelectedTabControls();
            RefreshOverflowList();
            ApplyTabWorkspaceLocalization();
        }
        finally
        {
            _loadingTabWorkspace = wasLoading;
        }
        Dispatcher.BeginInvoke(UpdateTabOverflowIndicator, DispatcherPriority.Background);
    }

    private void ReorderAndDecorateMainTabs()
    {
        if (_tabWorkspace is null) return;
        var ordered = _tabWorkspace.OrderedTabs().ToArray();
        for (var index = 0; index < ordered.Length; index++)
        {
            var state = ordered[index];
            if (!_mainTabItems.TryGetValue(state.Id, out var item)) continue;
            var currentIndex = MainTabs.Items.IndexOf(item);
            if (currentIndex != index)
            {
                MainTabs.Items.Remove(item);
                MainTabs.Items.Insert(index, item);
            }
            item.Visibility = _tabWorkspace.IsVisibleInStrip(state)
                ? Visibility.Visible
                : Visibility.Collapsed;
            item.Header = BuildTabHeader(state);
            item.ContextMenu = BuildTabContextMenu(state);
            var group = state.GroupId is null
                ? null
                : _tabWorkspace.State.Groups.FirstOrDefault(candidate => candidate.Id == state.GroupId);
            var label = _tabWorkspace.VisibleLabel(state.Id, _settings.LanguageMode);
            System.Windows.Automation.AutomationProperties.SetName(item,
                $"{label}; {(state.IsPinned ? "pinned" : "regular")}; " +
                $"{(state.IsOpen ? "open" : "closed")}" +
                (group is null ? "" : $"; group {group.Name}"));
        }

        if (_mainTabItems.TryGetValue(_tabWorkspace.State.SelectedTabId, out var selected) &&
            selected.Visibility == Visibility.Visible)
            MainTabs.SelectedItem = selected;
        else
            MainTabs.SelectedItem = ordered
                .Where(_tabWorkspace.IsVisibleInStrip)
                .Select(state => _mainTabItems[state.Id])
                .FirstOrDefault();
    }

    private FrameworkElement BuildTabHeader(TabState state)
    {
        var panel = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
        if (state.IsPinned)
        {
            panel.Children.Add(new TextBlock
            {
                Text = "●",
                Margin = new Thickness(0, 0, 7, 0),
                VerticalAlignment = VerticalAlignment.Center,
                ToolTip = TabText("Pinned tab", "已釘選分頁"),
            });
        }

        if (state.GroupId is not null &&
            _tabWorkspace?.State.Groups.FirstOrDefault(group => group.Id == state.GroupId) is { } group)
        {
            panel.Children.Add(new Border
            {
                Width = 10,
                Height = 10,
                CornerRadius = new CornerRadius(5),
                Background = TryBrush(group.Color) ?? Brushes.MediumPurple,
                Margin = new Thickness(0, 0, 7, 0),
                ToolTip = group.Name,
            });
        }

        var label = new TextBlock
        {
            Text = _tabWorkspace?.VisibleLabel(state.Id, _settings.LanguageMode) ?? state.Id,
            VerticalAlignment = VerticalAlignment.Center,
        };
        label.SetBinding(TextBlock.ForegroundProperty, new Binding(nameof(TabItem.Foreground))
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.FindAncestor, typeof(TabItem), 1),
        });
        ApplyTabAppearance(label, state.Appearance);
        panel.Children.Add(label);

        var wrapper = new Border { Child = panel };
        if (TryBrush(state.Appearance.Highlight) is { } highlight)
        {
            wrapper.Background = highlight;
            wrapper.CornerRadius = new CornerRadius(6);
            wrapper.Padding = new Thickness(4, 2, 4, 2);
        }
        return wrapper;
    }

    private static void ApplyTabAppearance(TextBlock label, TabAppearanceSettings appearance)
    {
        if (!string.IsNullOrWhiteSpace(appearance.FontFamily))
        {
            try { label.FontFamily = new FontFamily(appearance.FontFamily); } catch { /* normalized fallback */ }
        }
        if (appearance.FontSize is { } size) label.FontSize = size;
        if (!string.IsNullOrWhiteSpace(appearance.FontWeight))
        {
            try
            {
                label.FontWeight = (FontWeight)new FontWeightConverter().ConvertFromString(appearance.FontWeight)!;
            }
            catch { /* keep inherited weight */ }
        }
        if (appearance.Italic) label.FontStyle = FontStyles.Italic;
        var decorations = new TextDecorationCollection();
        if (appearance.Underline) decorations.Add(TextDecorations.Underline[0]);
        if (appearance.Strikethrough) decorations.Add(TextDecorations.Strikethrough[0]);
        if (decorations.Count > 0) label.TextDecorations = decorations;
        if (TryBrush(appearance.Foreground) is { } foreground) label.Foreground = foreground;
        if (appearance.LineHeight is { } lineHeight) label.LineHeight = lineHeight;
        label.ToolTip = Math.Abs(appearance.LetterSpacing) > 0.001
            ? $"Requested letter spacing: {appearance.LetterSpacing:0.##}"
            : null;
    }

    private ContextMenu BuildTabContextMenu(TabState state)
    {
        var menu = new ContextMenu();
        var pin = new MenuItem
        {
            Header = state.IsPinned ? TabText("Unpin tab", "取消釘選分頁") : TabText("Pin tab", "釘選分頁"),
        };
        pin.Click += (_, _) => MutateTabWorkspace(() => _tabWorkspace?.TogglePin(state.Id) == true);
        menu.Items.Add(pin);

        var moveLeft = new MenuItem { Header = TabText("Move left", "向左移") };
        moveLeft.Click += (_, _) => MutateTabWorkspace(() => _tabWorkspace?.MoveTab(state.Id, -1) == true);
        menu.Items.Add(moveLeft);
        var moveRight = new MenuItem { Header = TabText("Move right", "向右移") };
        moveRight.Click += (_, _) => MutateTabWorkspace(() => _tabWorkspace?.MoveTab(state.Id, 1) == true);
        menu.Items.Add(moveRight);

        var groupMenu = new MenuItem { Header = TabText("Move to group", "移到群組") };
        var ungrouped = new MenuItem { Header = TabText("Ungrouped", "未分組"), IsCheckable = true, IsChecked = state.GroupId is null };
        ungrouped.Click += (_, _) => MutateTabWorkspace(() => _tabWorkspace?.AssignToGroup(state.Id, null) == true);
        groupMenu.Items.Add(ungrouped);
        var availableGroups = _tabWorkspace is null
            ? Enumerable.Empty<TabGroupState>()
            : _tabWorkspace.State.Groups.OrderBy(group => group.Order);
        foreach (var group in availableGroups)
        {
            var groupItem = new MenuItem { Header = group.Name, IsCheckable = true, IsChecked = state.GroupId == group.Id };
            groupItem.Click += (_, _) => MutateTabWorkspace(() => _tabWorkspace?.AssignToGroup(state.Id, group.Id) == true);
            groupMenu.Items.Add(groupItem);
        }
        menu.Items.Add(groupMenu);

        menu.Items.Add(new Separator());
        var close = new MenuItem
        {
            Header = TabText("Close tab", "關閉分頁"),
            IsEnabled = !state.IsPinned && (_tabWorkspace?.State.Tabs.Count(tab => tab.IsOpen) ?? 0) > 1,
        };
        close.Click += async (_, _) => await CloseTabWithGuardAsync(state.Id);
        menu.Items.Add(close);
        return menu;
    }

    private void RebuildTabGroupChips()
    {
        if (_tabWorkspace is null || TabGroupChipPanel is null) return;
        TabGroupChipPanel.Children.Clear();
        foreach (var group in _tabWorkspace.State.Groups.OrderBy(group => group.Order))
        {
            var count = _tabWorkspace.State.Tabs.Count(tab => tab.GroupId == group.Id);
            var chipText = $"{(group.IsCollapsed ? "▶" : "▼")} {group.Name} · {count}";
            var button = new Button
            {
                Content = new TextBlock
                {
                    Text = chipText,
                    TextWrapping = TextWrapping.Wrap,
                    MaxWidth = 240,
                },
                Tag = group.Id,
                Margin = new Thickness(0, 0, 8, 0),
                MaxWidth = 288,
                Style = (Style)FindResource("Btn"),
                BorderBrush = TryBrush(group.Color) ?? (Brush)FindResource("Outline"),
                ToolTip = group.Name + Environment.NewLine +
                          TabText("Collapse or expand this group", "收合或展開呢個群組"),
            };
            System.Windows.Automation.AutomationProperties.SetName(button,
                $"{group.Name}; {count} tabs; {(group.IsCollapsed ? "collapsed" : "expanded")}");
            button.Click += TabGroupChip_Click;
            TabGroupChipPanel.Children.Add(button);
        }
    }

    private void RefreshTabGroupSelectors()
    {
        if (_tabWorkspace is null) return;
        var wasLoading = _loadingTabWorkspace;
        _loadingTabWorkspace = true;
        try
        {
            var selectedSearchId = (TabGroupSearchGroupBox.SelectedItem as TabGroupChoice)?.Id;
            var selectedEditorId = (TabGroupEditorSelection.SelectedItem as TabGroupChoice)?.Id;
            var groups = _tabWorkspace.State.Groups.OrderBy(group => group.Order)
                .Select(group => new TabGroupChoice(group.Id,
                    $"{group.Name} · {_tabWorkspace.State.Tabs.Count(tab => tab.GroupId == group.Id)}"))
                .ToArray();

            TabGroupSearchGroupBox.ItemsSource = groups;
            TabGroupSearchGroupBox.SelectedItem = groups.FirstOrDefault(choice => choice.Id == selectedSearchId) ?? groups.FirstOrDefault();
            TabGroupEditorSelection.ItemsSource = groups;
            TabGroupEditorSelection.SelectedItem = groups.FirstOrDefault(choice => choice.Id == selectedEditorId) ?? groups.FirstOrDefault();

            var assignmentChoices = new[] { new TabGroupChoice(null, TabText("Ungrouped", "未分組")) }
                .Concat(groups).ToArray();
            SelectedTabGroupBox.ItemsSource = assignmentChoices;
            var selectedTab = SelectedMainTabState();
            SelectedTabGroupBox.SelectedItem = assignmentChoices.FirstOrDefault(choice => choice.Id == selectedTab?.GroupId)
                ?? assignmentChoices[0];
            LoadSelectedGroupEditorFields();
        }
        finally { _loadingTabWorkspace = wasLoading; }
    }

    private void RefreshSelectedTabControls()
    {
        var selected = SelectedMainTabState();
        if (selected is null) return;
        PinSelectedTabButton.Content = selected.IsPinned
            ? TabText("Unpin", "取消釘選")
            : TabText("Pin", "釘選");
        if (SelectedTabGroupBox.ItemsSource is IEnumerable<TabGroupChoice> choices)
        {
            var wasLoading = _loadingTabWorkspace;
            _loadingTabWorkspace = true;
            try
            {
                SelectedTabGroupBox.SelectedItem = choices.FirstOrDefault(choice => choice.Id == selected.GroupId)
                    ?? choices.FirstOrDefault();
            }
            finally { _loadingTabWorkspace = wasLoading; }
        }
    }

    private TabState? SelectedMainTabState()
    {
        if (_tabWorkspace is null || MainTabs.SelectedItem is not TabItem item || item.Tag is not string id) return null;
        return _tabWorkspace.State.Tabs.FirstOrDefault(tab => tab.Id == id);
    }

    private void MutateTabWorkspace(Func<bool> mutation)
    {
        if (_tabWorkspace is null || _closingForDrain || !TabWorkspaceBar.IsEnabled || !mutation()) return;
        _settings.TabWorkspace = _tabWorkspace.State;
        RefreshTabWorkspaceVisuals(reloadSearchControls: false);
        RefreshTabSearchResults();
        RefreshTabClosePreview();
        PersistTabWorkspaceNow();
    }

    private void ScheduleTabWorkspaceSave()
    {
        if (_loadingTabWorkspace || _closingForDrain) return;
        _settings.TabWorkspace = _tabWorkspace?.State ?? _settings.TabWorkspace;
        _preferenceSaveTimer.Stop();
        _preferenceSaveTimer.Start();
    }

    private void PersistTabWorkspaceNow()
    {
        if (_loadingTabWorkspace || _closingForDrain) return;
        _settings.TabWorkspace = _tabWorkspace?.State ?? _settings.TabWorkspace;
        _preferenceSaveTimer.Stop();
        PersistSettings();
    }

    private string TabText(string english, string cantonese) => _settings.LanguageMode switch
    {
        "Cantonese" => cantonese,
        "Bilingual" => english + " · " + cantonese,
        _ => english,
    };

    private string TabMessage(string english, string cantonese) => AppCopy.Format(
        english,
        cantonese,
        _settings.LanguageMode,
        _settings.EnglishFunnyLevel,
        _settings.CantoneseFunnyLevel);

    private void ApplyTabWorkspaceLocalization()
    {
        TabWorkspaceCopy.Apply(TabWorkspaceBar, _settings.LanguageMode);
        TabWorkspaceCopy.Apply(TabSearchPopup.Child, _settings.LanguageMode);
        TabWorkspaceCopy.Apply(TabGroupPopup.Child, _settings.LanguageMode);
        TabWorkspaceCopy.Apply(TabOverflowPopup.Child, _settings.LanguageMode);
    }

    internal static SolidColorBrush? TryBrush(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        try
        {
            var text = value.Trim();
            if (text.Length is 7 or 9 && text[0] == '#' && text.Skip(1).All(Uri.IsHexDigit))
            {
                var red = Convert.ToByte(text.Substring(1, 2), 16);
                var green = Convert.ToByte(text.Substring(3, 2), 16);
                var blue = Convert.ToByte(text.Substring(5, 2), 16);
                var alpha = text.Length == 9 ? Convert.ToByte(text.Substring(7, 2), 16) : byte.MaxValue;
                return new SolidColorBrush(Color.FromArgb(alpha, red, green, blue));
            }
            return new SolidColorBrush((Color)ColorConverter.ConvertFromString(text));
        }
        catch { return null; }
    }

    private void MainTabs_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_loadingTabWorkspace || _closingForDrain || !TabWorkspaceBar.IsEnabled ||
            _tabWorkspace is null || !ReferenceEquals(e.OriginalSource, MainTabs)) return;
        if (MainTabs.SelectedItem is not TabItem item || item.Tag is not string id) return;
        if (!_tabWorkspace.Activate(id)) return;
        _settings.TabWorkspace = _tabWorkspace.State;
        RefreshTabWorkspaceVisuals(reloadSearchControls: false);
        RefreshTabSearchResults();
        RefreshTabClosePreview();
        ScheduleTabWorkspaceSave();
    }

    private void PinSelectedTab_Click(object sender, RoutedEventArgs e)
    {
        if (SelectedMainTabState() is { } selected)
            MutateTabWorkspace(() => _tabWorkspace?.TogglePin(selected.Id) == true);
    }

    private void MoveSelectedTabLeft_Click(object sender, RoutedEventArgs e)
    {
        if (SelectedMainTabState() is { } selected)
            MutateTabWorkspace(() => _tabWorkspace?.MoveTab(selected.Id, -1) == true);
    }

    private void MoveSelectedTabRight_Click(object sender, RoutedEventArgs e)
    {
        if (SelectedMainTabState() is { } selected)
            MutateTabWorkspace(() => _tabWorkspace?.MoveTab(selected.Id, 1) == true);
    }

    private void TabWorkspace_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (_tabWorkspace is null) return;
        var modifiers = Keyboard.Modifiers;
        if (e.Key == Key.Escape)
        {
            if (CloseOpenRegexPopup())
            {
                e.Handled = true;
                return;
            }
            if (TabSearchPopup.IsOpen)
            {
                TabSearchPopup.IsOpen = false;
                TabSearchButton.Focus();
                e.Handled = true;
                return;
            }
            if (TabGroupPopup.IsOpen)
            {
                TabGroupPopup.IsOpen = false;
                TabGroupButton.Focus();
                e.Handled = true;
                return;
            }
            if (TabOverflowPopup.IsOpen)
            {
                TabOverflowPopup.IsOpen = false;
                TabOverflowButton.Focus();
                e.Handled = true;
            }
            return;
        }
        if (e.Key == Key.P && modifiers == (ModifierKeys.Control | ModifierKeys.Shift))
        {
            PinSelectedTab_Click(sender, e);
            e.Handled = true;
        }
        else if (e.Key is Key.Left or Key.Right && modifiers == (ModifierKeys.Alt | ModifierKeys.Shift))
        {
            if (e.Key == Key.Left) MoveSelectedTabLeft_Click(sender, e);
            else MoveSelectedTabRight_Click(sender, e);
            e.Handled = true;
        }
        else if (e.Key == Key.W && modifiers == ModifierKeys.Control)
        {
            _ = CloseSelectedTabWithGuardAsync();
            e.Handled = true;
        }
        else if (e.Key == Key.F && modifiers == (ModifierKeys.Control | ModifierKeys.Shift))
        {
            TabSearchPopup.IsOpen = true;
            CurrentTabSearchBox.Focus();
            e.Handled = true;
        }
    }

    private bool CloseOpenRegexPopup()
    {
        foreach (var popup in new[]
                 {
                     CurrentTabRegexPopup, GroupTabRegexPopup, GroupNameRegexPopup,
                     MasterTabRegexPopup, TabCloseRegexPopup,
                 })
        {
            if (!popup.IsOpen) continue;
            popup.IsOpen = false;
            return true;
        }
        return false;
    }

    private void SetWorkspaceInteractionEnabled(bool enabled)
    {
        MainTabs.IsEnabled = enabled;
        TabWorkspaceBar.IsEnabled = enabled;
        if (!enabled) CloseWorkspacePopups();
    }

    private void CloseWorkspacePopups()
    {
        CurrentTabRegexPopup.IsOpen = false;
        GroupTabRegexPopup.IsOpen = false;
        GroupNameRegexPopup.IsOpen = false;
        MasterTabRegexPopup.IsOpen = false;
        TabCloseRegexPopup.IsOpen = false;
        TabSearchPopup.IsOpen = false;
        TabGroupPopup.IsOpen = false;
        TabOverflowPopup.IsOpen = false;
    }

    private async Task CloseSelectedTabWithGuardAsync()
    {
        if (SelectedMainTabState() is { } selected) await CloseTabWithGuardAsync(selected.Id);
    }

    private async Task CloseTabWithGuardAsync(string tabId)
    {
        if (_tabWorkspace is null) return;
        var state = _tabWorkspace.State.Tabs.FirstOrDefault(tab => tab.Id == tabId);
        if (state is null) return;
        if (state.IsPinned)
        {
            ShowToast("info", TabText("Pinned tab stayed open", "已釘選分頁保持開啟"),
                TabMessage("Unpin the tab before closing it.", "要先取消釘選，先可以關閉分頁。"));
            return;
        }
        if (!await SaveWorkspaceBeforeCloseAsync()) return;
        if (!_tabWorkspace.CloseTab(tabId))
        {
            ShowToast("warn", TabText("Tab stayed open", "分頁保持開啟"),
                TabMessage("At least one application tab must remain open.", "最少要保留一個應用程式分頁。"));
            return;
        }
        _settings.TabWorkspace = _tabWorkspace.State;
        RefreshTabWorkspaceVisuals(reloadSearchControls: false);
        RefreshTabSearchResults();
        RefreshTabClosePreview();
        PersistTabWorkspaceNow();
    }

    private async Task<bool> SaveWorkspaceBeforeCloseAsync()
    {
        _preferenceSaveTimer.Stop();
        ApplySettingsFromUi();
        _settings.TabWorkspace = _tabWorkspace?.State ?? _settings.TabWorkspace;
        var json = _settings.ToJson();
        _lastSettingsSaveTask = _settingsMutationQueue.Enqueue(() => PersistSettingsSnapshotAsync(json));
        if (await _lastSettingsSaveTask)
        {
            MarkPasswordInputsSaved();
            return true;
        }
        ShowToast("error", TabText("Tab close was cancelled", "已取消關閉分頁"),
            TabMessage("Pending settings could not be saved, so no tab was closed.", "未能儲存待處理設定，所以冇關閉任何分頁。"));
        return false;
    }

    private void MainTab_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (sender is not TabItem item || item.Tag is not string id) return;
        _tabDragStart = e.GetPosition(MainTabs);
        _draggedTabId = id;
    }

    private void MainTab_PreviewMouseMove(object sender, MouseEventArgs e)
    {
        if (e.LeftButton != MouseButtonState.Pressed || _draggedTabId is null) return;
        var point = e.GetPosition(MainTabs);
        if (Math.Abs(point.X - _tabDragStart.X) < SystemParameters.MinimumHorizontalDragDistance &&
            Math.Abs(point.Y - _tabDragStart.Y) < SystemParameters.MinimumVerticalDragDistance) return;
        var data = new DataObject(TabDragDataFormat, _draggedTabId);
        DragDrop.DoDragDrop((DependencyObject)sender, data, DragDropEffects.Move);
        _draggedTabId = null;
    }

    private void MainTab_PreviewMouseLeftButtonUp(object sender, MouseButtonEventArgs e) =>
        _draggedTabId = null;

    private void MainTab_LostMouseCapture(object sender, MouseEventArgs e)
    {
        if (e.LeftButton != MouseButtonState.Pressed) _draggedTabId = null;
    }

    private void MainTabs_DragOver(object sender, DragEventArgs e)
    {
        e.Effects = CanDropTab(e) ? DragDropEffects.Move : DragDropEffects.None;
        e.Handled = true;
    }

    private void MainTabs_Drop(object sender, DragEventArgs e)
    {
        if (_tabWorkspace is null || !CanDropTab(e)) return;
        var draggedId = e.Data.GetData(TabDragDataFormat) as string;
        var target = FindAncestor<TabItem>(e.OriginalSource as DependencyObject);
        if (draggedId is null) return;
        if (target?.Tag is string targetId)
        {
            var after = e.GetPosition(target).X >= target.ActualWidth / 2;
            MutateTabWorkspace(() => _tabWorkspace.MoveTabRelative(draggedId, targetId, after));
        }
        else if (IsOverTabHeaderScroller(e))
        {
            MutateTabWorkspace(() => _tabWorkspace.MoveTabToRegionEnd(draggedId));
        }
        e.Handled = true;
    }

    private bool CanDropTab(DragEventArgs e)
    {
        if (_tabWorkspace is null || !e.Data.GetDataPresent(TabDragDataFormat)) return false;
        var draggedId = e.Data.GetData(TabDragDataFormat) as string;
        var target = FindAncestor<TabItem>(e.OriginalSource as DependencyObject);
        if (draggedId is null) return false;
        if (target?.Tag is not string targetId) return IsOverTabHeaderScroller(e);
        if (draggedId == targetId) return false;
        var dragged = _tabWorkspace.State.Tabs.FirstOrDefault(tab => tab.Id == draggedId);
        var targetState = _tabWorkspace.State.Tabs.FirstOrDefault(tab => tab.Id == targetId);
        return dragged is not null && targetState is not null && dragged.IsPinned == targetState.IsPinned;
    }

    private bool IsOverTabHeaderScroller(DragEventArgs e)
    {
        if (MainTabs.Template.FindName("TabHeaderScroller", MainTabs) is not ScrollViewer scroller ||
            scroller.ActualWidth <= 0 || scroller.ActualHeight <= 0) return false;
        var point = e.GetPosition(scroller);
        return point.X >= 0 && point.X <= scroller.ActualWidth &&
               point.Y >= 0 && point.Y <= scroller.ActualHeight;
    }

    private static T? FindAncestor<T>(DependencyObject? node) where T : DependencyObject
    {
        while (node is not null)
        {
            if (node is T match) return match;
            node = VisualTreeHelper.GetParent(node);
        }
        return null;
    }

    private void MainTabs_SizeChanged(object sender, SizeChangedEventArgs e) =>
        Dispatcher.BeginInvoke(UpdateTabOverflowIndicator, DispatcherPriority.Background);

    private void UpdateTabOverflowIndicator()
    {
        if (_tabWorkspace is null || TabOverflowButton is null || MainTabs.Template is null) return;
        var scroller = MainTabs.Template.FindName("TabHeaderScroller", MainTabs) as ScrollViewer;
        var overflowed = scroller is not null && scroller.ExtentWidth > scroller.ViewportWidth + 1;
        var visible = _tabWorkspace.State.Tabs.Count(_tabWorkspace.IsVisibleInStrip);
        TabOverflowButton.Content = overflowed
            ? TabText($"Overflow · {visible}", $"更多分頁 · {visible}")
            : TabText($"All tabs · {visible}", $"全部分頁 · {visible}");
        System.Windows.Automation.AutomationProperties.SetHelpText(TabOverflowButton, overflowed
            ? TabText("Some tab headers are outside the visible strip; open this list to reach them.", "部分分頁標題喺可見範圍外；開啟此清單即可前往。")
            : TabText("Open the complete tab list, including closed tabs.", "開啟完整分頁清單，包括已關閉分頁。"));
        RefreshOverflowList();
    }

    private void RefreshOverflowList()
    {
        if (_tabWorkspace is null || TabOverflowList is null) return;
        var hits = _tabWorkspace.AllTabHits(_settings.LanguageMode);
        TabOverflowList.ItemsSource = hits;
        var closed = hits.Count(hit => !hit.IsOpen);
        TabOverflowFeedback.Text = TabText(
            $"{hits.Count} total; {closed} closed. Activate any row to open and select it.",
            $"共 {hits.Count} 個；{closed} 個已關閉。啟用任何一行即可開啟並選取。 ");
    }

    private void TabOverflowButton_Click(object sender, RoutedEventArgs e)
    {
        RefreshOverflowList();
        TabOverflowPopup.IsOpen = true;
        TabOverflowList.Focus();
    }

    private void CloseTabOverflowPopup_Click(object sender, RoutedEventArgs e)
    {
        TabOverflowPopup.IsOpen = false;
        TabOverflowButton.Focus();
    }

    private void TabGroupButton_Click(object sender, RoutedEventArgs e)
    {
        RefreshTabGroupSelectors();
        TabGroupPopup.PlacementTarget = TabGroupButton;
        TabGroupPopup.IsOpen = true;
        TabGroupEditorSelection.Focus();
    }

    private void CloseTabGroupPopup_Click(object sender, RoutedEventArgs e)
    {
        TabGroupPopup.IsOpen = false;
        TabGroupButton.Focus();
    }

    private void TabGroupChip_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: string id })
            MutateTabWorkspace(() => _tabWorkspace?.ToggleGroupCollapsed(id) == true);
    }

    private void TabGroupEditorSelection_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (!_loadingTabWorkspace) LoadSelectedGroupEditorFields();
    }

    private void LoadSelectedGroupEditorFields()
    {
        if (_tabWorkspace is null) return;
        var id = (TabGroupEditorSelection.SelectedItem as TabGroupChoice)?.Id;
        var group = _tabWorkspace.State.Groups.FirstOrDefault(candidate => candidate.Id == id);
        TabGroupNameBox.Text = group?.Name ?? "";
        TabGroupColorBox.Text = group?.Color ?? "#6750A4";
        TabGroupFeedback.Text = group is null
            ? TabText("Create a group, then assign the selected tab.", "建立群組後，再將目前分頁分配入去。")
            : TabText(
                $"{_tabWorkspace.State.Tabs.Count(tab => tab.GroupId == group.Id)} tab(s); {(group.IsCollapsed ? "collapsed" : "expanded")}.",
                $"{_tabWorkspace.State.Tabs.Count(tab => tab.GroupId == group.Id)} 個分頁；{(group.IsCollapsed ? "已收合" : "已展開")}。");
    }

    private void CreateTabGroup_Click(object sender, RoutedEventArgs e)
    {
        if (_tabWorkspace is null) return;
        try
        {
            var id = _tabWorkspace.CreateGroup(TabGroupNameBox.Text, TabGroupColorBox.Text);
            _settings.TabWorkspace = _tabWorkspace.State;
            RefreshTabWorkspaceVisuals(reloadSearchControls: false);
            if (TabGroupEditorSelection.ItemsSource is IEnumerable<TabGroupChoice> choices)
                TabGroupEditorSelection.SelectedItem = choices.FirstOrDefault(choice => choice.Id == id);
            RefreshTabSearchResults();
            PersistTabWorkspaceNow();
        }
        catch (Exception ex)
        {
            TabGroupFeedback.Text = ex.Message;
        }
    }

    private void SaveTabGroup_Click(object sender, RoutedEventArgs e)
    {
        if ((TabGroupEditorSelection.SelectedItem as TabGroupChoice)?.Id is not string id) return;
        try
        {
            MutateTabWorkspace(() => _tabWorkspace?.UpdateGroup(id, TabGroupNameBox.Text, TabGroupColorBox.Text) == true);
        }
        catch (Exception ex) { TabGroupFeedback.Text = ex.Message; }
    }

    private void MoveTabGroupLeft_Click(object sender, RoutedEventArgs e) => MoveSelectedGroup(-1);
    private void MoveTabGroupRight_Click(object sender, RoutedEventArgs e) => MoveSelectedGroup(1);

    private void MoveSelectedGroup(int direction)
    {
        if ((TabGroupEditorSelection.SelectedItem as TabGroupChoice)?.Id is string id)
            MutateTabWorkspace(() => _tabWorkspace?.MoveGroup(id, direction) == true);
    }

    private void ToggleTabGroupCollapsed_Click(object sender, RoutedEventArgs e)
    {
        if ((TabGroupEditorSelection.SelectedItem as TabGroupChoice)?.Id is string id)
            MutateTabWorkspace(() => _tabWorkspace?.ToggleGroupCollapsed(id) == true);
    }

    private void DeleteTabGroup_Click(object sender, RoutedEventArgs e)
    {
        if ((TabGroupEditorSelection.SelectedItem as TabGroupChoice)?.Id is not string id || _tabWorkspace is null) return;
        var group = _tabWorkspace.State.Groups.FirstOrDefault(candidate => candidate.Id == id);
        if (group is null) return;
        var decision = MessageBox.Show(
            TabMessage(
                $"Delete group '{group.Name}'? Its tabs remain open and become ungrouped.",
                $"刪除群組「{group.Name}」？當中分頁會繼續開啟並變成未分組。"),
            TabText("Delete tab group", "刪除分頁群組"), MessageBoxButton.YesNo, MessageBoxImage.Warning);
        if (decision == MessageBoxResult.Yes)
            MutateTabWorkspace(() => _tabWorkspace.DeleteGroup(id));
    }

    private void SelectedTabGroup_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (_loadingTabWorkspace || _tabWorkspace is null || SelectedMainTabState() is not { } selected) return;
        if (SelectedTabGroupBox.SelectedItem is not TabGroupChoice choice) return;
        MutateTabWorkspace(() => _tabWorkspace.AssignToGroup(selected.Id, choice.Id));
    }
}
