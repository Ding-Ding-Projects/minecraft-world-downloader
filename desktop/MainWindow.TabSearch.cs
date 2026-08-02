using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;

namespace WorldDownloaderManager;

public partial class MainWindow
{
    private sealed record TabSearchUi(
        string Key,
        TabSearchScope Scope,
        TextBox Query,
        CheckBox Regex,
        TextBlock Feedback,
        ListBox Results);

    private sealed record TabRegexUi(
        string Key,
        Popup Popup,
        RegexBuilderPopover Builder,
        TextBox Query,
        CheckBox Regex);

    private void LoadTabSearchControlsFromState()
    {
        if (_tabWorkspace is null || CurrentTabSearchBox is null) return;
        LoadSearchUi("current", _tabWorkspace.State.CurrentStripSearch);
        LoadSearchUi("group-names", _tabWorkspace.State.GroupNameSearch);
        LoadSearchUi("master", _tabWorkspace.State.MasterSearch);

        var groupId = SelectedGroupSearchId();
        var groupState = groupId is not null && _tabWorkspace.State.GroupTabSearches.TryGetValue(groupId, out var stored)
            ? stored
            : new TabSearchState();
        LoadSearchUi("group-tabs", groupState);

        var close = _tabWorkspace.State.CloseSearch;
        TabCloseSearchBox.Text = close.Query;
        TabCloseRegexCheck.IsChecked = close.UseRegex;
        TabCloseModeBox.SelectedIndex = close.CloseNotContaining ? 1 : 0;
        TabCloseIncludePinnedCheck.IsChecked = close.IncludePinned;
    }

    private void LoadSearchUi(string key, TabSearchState state)
    {
        var ui = GetSearchUi(key);
        ui.Query.Text = state.Query;
        ui.Regex.IsChecked = state.UseRegex;
    }

    private TabSearchUi GetSearchUi(string key) => key switch
    {
        "current" => new TabSearchUi(key, TabSearchScope.CurrentStrip,
            CurrentTabSearchBox, CurrentTabRegexCheck, CurrentTabSearchFeedback, CurrentTabSearchResults),
        "group-tabs" => new TabSearchUi(key, TabSearchScope.GroupTabs,
            GroupTabSearchBox, GroupTabRegexCheck, GroupTabSearchFeedback, GroupTabSearchResults),
        "group-names" => new TabSearchUi(key, TabSearchScope.GroupNames,
            GroupNameSearchBox, GroupNameRegexCheck, GroupNameSearchFeedback, GroupNameSearchResults),
        "master" => new TabSearchUi(key, TabSearchScope.Master,
            MasterTabSearchBox, MasterTabRegexCheck, MasterTabSearchFeedback, MasterTabSearchResults),
        _ => throw new ArgumentOutOfRangeException(nameof(key), key, "Unknown tab search surface."),
    };

    private TabRegexUi GetRegexUi(string key) => key switch
    {
        "current" => new TabRegexUi(key, CurrentTabRegexPopup, CurrentTabRegexBuilder,
            CurrentTabSearchBox, CurrentTabRegexCheck),
        "group-tabs" => new TabRegexUi(key, GroupTabRegexPopup, GroupTabRegexBuilder,
            GroupTabSearchBox, GroupTabRegexCheck),
        "group-names" => new TabRegexUi(key, GroupNameRegexPopup, GroupNameRegexBuilder,
            GroupNameSearchBox, GroupNameRegexCheck),
        "master" => new TabRegexUi(key, MasterTabRegexPopup, MasterTabRegexBuilder,
            MasterTabSearchBox, MasterTabRegexCheck),
        "close" => new TabRegexUi(key, TabCloseRegexPopup, TabCloseRegexBuilder,
            TabCloseSearchBox, TabCloseRegexCheck),
        _ => throw new ArgumentOutOfRangeException(nameof(key), key, "Unknown regex surface."),
    };

    private string? SearchKeyForSender(object sender)
    {
        if (ReferenceEquals(sender, CurrentTabSearchBox) || ReferenceEquals(sender, CurrentTabRegexCheck)) return "current";
        if (ReferenceEquals(sender, GroupTabSearchBox) || ReferenceEquals(sender, GroupTabRegexCheck)) return "group-tabs";
        if (ReferenceEquals(sender, GroupNameSearchBox) || ReferenceEquals(sender, GroupNameRegexCheck)) return "group-names";
        if (ReferenceEquals(sender, MasterTabSearchBox) || ReferenceEquals(sender, MasterTabRegexCheck)) return "master";
        return null;
    }

    private void TabSearchButton_Click(object sender, RoutedEventArgs e)
    {
        RefreshTabSearchResults();
        TabSearchPopup.IsOpen = true;
        CurrentTabSearchBox.Focus();
    }

    private void CloseTabSearchPopup_Click(object sender, RoutedEventArgs e)
    {
        TabSearchPopup.IsOpen = false;
        TabSearchButton.Focus();
    }

    private void TabSearchInput_Changed(object sender, TextChangedEventArgs e)
    {
        if (_loadingTabWorkspace || SearchKeyForSender(sender) is not string key) return;
        UpdateSearchStateFromUi(key);
    }

    private void TabSearchMode_Changed(object sender, RoutedEventArgs e)
    {
        if (_loadingTabWorkspace || SearchKeyForSender(sender) is not string key) return;
        UpdateSearchStateFromUi(key);
    }

    private void UpdateSearchStateFromUi(string key)
    {
        if (_tabWorkspace is null) return;
        var ui = GetSearchUi(key);
        var existing = GetPersistedSearchState(key);
        var groupId = key == "group-tabs" ? SelectedGroupSearchId() : null;
        if (key == "group-tabs" && groupId is null)
        {
            RefreshTabSearchResults();
            return;
        }

        _tabWorkspace.ReplaceSearchState(ui.Scope, new TabSearchState
        {
            Query = ui.Query.Text,
            UseRegex = ui.Regex.IsChecked == true,
            Flags = existing.Flags,
        }, groupId);
        _settings.TabWorkspace = _tabWorkspace.State;
        RefreshTabSearchResults();
        RefreshTabClosePreview();
        ScheduleTabWorkspaceSave();
    }

    private TabSearchState GetPersistedSearchState(string key)
    {
        if (_tabWorkspace is null) return new TabSearchState();
        return key switch
        {
            "current" => _tabWorkspace.State.CurrentStripSearch,
            "group-tabs" when SelectedGroupSearchId() is string groupId &&
                              _tabWorkspace.State.GroupTabSearches.TryGetValue(groupId, out var state) => state,
            "group-names" => _tabWorkspace.State.GroupNameSearch,
            "master" => _tabWorkspace.State.MasterSearch,
            _ => new TabSearchState(),
        };
    }

    private string? SelectedGroupSearchId() =>
        (TabGroupSearchGroupBox.SelectedItem as TabGroupChoice)?.Id;

    private void TabGroupSearchGroup_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (_loadingTabWorkspace || _tabWorkspace is null) return;
        _loadingTabWorkspace = true;
        try
        {
            var state = SelectedGroupSearchId() is string groupId &&
                        _tabWorkspace.State.GroupTabSearches.TryGetValue(groupId, out var stored)
                ? stored
                : new TabSearchState();
            LoadSearchUi("group-tabs", state);
        }
        finally { _loadingTabWorkspace = false; }
        RefreshTabSearchResults();
    }

    private void RefreshTabSearchResults()
    {
        if (_tabWorkspace is null || CurrentTabSearchResults is null) return;
        foreach (var key in new[] { "current", "group-tabs", "group-names", "master" })
        {
            var ui = GetSearchUi(key);
            var result = _tabWorkspace.Search(ui.Scope, _settings.LanguageMode,
                key == "group-tabs" ? SelectedGroupSearchId() : null);
            ui.Results.ItemsSource = result.Hits;
            ui.Feedback.Text = result.IsValid
                ? TabText(
                    $"{result.Hits.Count} result(s) · {(ui.Regex.IsChecked == true ? "regex" : "plain text")}.",
                    $"{result.Hits.Count} 個結果 · {(ui.Regex.IsChecked == true ? "正則表達式" : "純文字")}。")
                : TabText("Search error: ", "搜尋錯誤：") + result.Error;
        }
        RefreshOverflowList();
    }

    private void OpenTabRegexBuilder_Click(object sender, RoutedEventArgs e)
    {
        if (_tabWorkspace is null || sender is not FrameworkElement { Tag: string key }) return;
        var ui = GetRegexUi(key);
        var flags = key == "close"
            ? _tabWorkspace.State.CloseSearch.Flags
            : GetPersistedSearchState(key).Flags;
        ui.Builder.LoadState(ui.Query.Text, flags, BuildTabRegexSample(key));
        ui.Popup.IsOpen = true;
        Dispatcher.BeginInvoke(ui.Builder.FocusPattern, DispatcherPriority.Input);
    }

    private string BuildTabRegexSample(string key)
    {
        if (_tabWorkspace is null) return "";
        IReadOnlyList<string> sample = key switch
        {
            "current" => _tabWorkspace.SearchSamples(TabSearchScope.CurrentStrip, _settings.LanguageMode),
            "group-tabs" when SelectedGroupSearchId() is string groupId =>
                _tabWorkspace.SearchSamples(TabSearchScope.GroupTabs, _settings.LanguageMode, groupId),
            "group-names" => _tabWorkspace.SearchSamples(TabSearchScope.GroupNames, _settings.LanguageMode),
            "master" => _tabWorkspace.SearchSamples(TabSearchScope.Master, _settings.LanguageMode),
            "close" => _tabWorkspace.CloseSearchSamples(_settings.LanguageMode),
            _ => Array.Empty<string>(),
        };
        var joined = string.Join('\n', sample);
        return joined.Length <= RegexBuilderService.MaxSampleLength
            ? joined
            : joined[..RegexBuilderService.MaxSampleLength];
    }

    private void TabRegexBuilder_ApplyRequested(object? sender, RegexApplyRequestedEventArgs e)
    {
        if (sender is not FrameworkElement { Tag: string key } || _tabWorkspace is null) return;
        var ui = GetRegexUi(key);
        _loadingTabWorkspace = true;
        try
        {
            ui.Query.Text = e.Pattern;
            ui.Regex.IsChecked = true;
        }
        finally { _loadingTabWorkspace = false; }

        if (key == "close")
            SyncTabCloseSearchFromUi(e.Flags);
        else
        {
            var searchUi = GetSearchUi(key);
            var groupId = key == "group-tabs" ? SelectedGroupSearchId() : null;
            if (key != "group-tabs" || groupId is not null)
            {
                _tabWorkspace.ReplaceSearchState(searchUi.Scope, new TabSearchState
                {
                    Query = e.Pattern,
                    UseRegex = true,
                    Flags = e.Flags,
                }, groupId);
                _settings.TabWorkspace = _tabWorkspace.State;
                RefreshTabSearchResults();
                RefreshTabClosePreview();
                ScheduleTabWorkspaceSave();
            }
        }
        ui.Popup.IsOpen = false;
    }

    private void TabRegexPopup_Closed(object? sender, EventArgs e)
    {
        var key = ReferenceEquals(sender, CurrentTabRegexPopup) ? "current"
            : ReferenceEquals(sender, GroupTabRegexPopup) ? "group-tabs"
            : ReferenceEquals(sender, GroupNameRegexPopup) ? "group-names"
            : ReferenceEquals(sender, MasterTabRegexPopup) ? "master"
            : "close";
        GetRegexUi(key).Query.Focus();
    }

    private void TabRegexBuilder_DismissRequested(object? sender, EventArgs e)
    {
        if (sender is FrameworkElement { Tag: string key })
            GetRegexUi(key).Popup.IsOpen = false;
    }

    private void TabSearchResult_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (sender is ListBox list && list.SelectedItem is TabSearchHit hit)
            ActivateTabSearchHit(hit);
    }

    private void TabSearchResult_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key is not (Key.Enter or Key.Space) || sender is not ListBox list ||
            list.SelectedItem is not TabSearchHit hit) return;
        ActivateTabSearchHit(hit);
        e.Handled = true;
    }

    private void ActivateTabSearchHit(TabSearchHit hit)
    {
        if (_tabWorkspace is null) return;
        if (hit.Kind == TabSearchHitKind.Group)
        {
            if (hit.IsGroupCollapsed) _tabWorkspace.SetGroupCollapsed(hit.Id, collapsed: false);
            _settings.TabWorkspace = _tabWorkspace.State;
            RefreshTabWorkspaceVisuals(reloadSearchControls: false);
            if (TabGroupSearchGroupBox.ItemsSource is IEnumerable<TabGroupChoice> choices)
                TabGroupSearchGroupBox.SelectedItem = choices.FirstOrDefault(choice => choice.Id == hit.Id);
            RefreshTabSearchResults();
            PersistTabWorkspaceNow();
            return;
        }

        if (!_tabWorkspace.Activate(hit.Id)) return;
        _settings.TabWorkspace = _tabWorkspace.State;
        RefreshTabWorkspaceVisuals(reloadSearchControls: false);
        RefreshTabSearchResults();
        RefreshTabClosePreview();
        PersistTabWorkspaceNow();
        TabSearchPopup.IsOpen = false;
        TabOverflowPopup.IsOpen = false;
        if (_mainTabItems.TryGetValue(hit.Id, out var item)) item.Focus();
    }

    private void TabCloseSearch_Changed(object sender, RoutedEventArgs e)
    {
        if (_loadingTabWorkspace) return;
        SyncTabCloseSearchFromUi(null);
    }

    private void SyncTabCloseSearchFromUi(string? flags)
    {
        if (_tabWorkspace is null) return;
        _tabWorkspace.ReplaceCloseSearch(new TabCloseSearchState
        {
            Query = TabCloseSearchBox.Text,
            UseRegex = TabCloseRegexCheck.IsChecked == true,
            Flags = flags ?? _tabWorkspace.State.CloseSearch.Flags,
            CloseNotContaining = TabCloseModeBox.SelectedIndex == 1,
            IncludePinned = TabCloseIncludePinnedCheck.IsChecked == true,
        });
        _settings.TabWorkspace = _tabWorkspace.State;
        _currentTabClosePreview = null;
        RefreshTabClosePreview();
        ScheduleTabWorkspaceSave();
    }

    private void PreviewTabClose_Click(object sender, RoutedEventArgs e) => RefreshTabClosePreview();

    private void RefreshTabClosePreview()
    {
        if (_tabWorkspace is null || TabClosePreviewText is null) return;
        var preview = _tabWorkspace.PreviewClose(_settings.LanguageMode);
        _currentTabClosePreview = preview.IsValid ? preview : null;
        ApplyTabCloseButton.IsEnabled = preview.IsValid && preview.Count > 0;
        if (!preview.IsValid)
        {
            TabClosePreviewText.Text = TabText("Preview unavailable: ", "未能預覽：") + preview.Error;
            return;
        }

        TabClosePreviewText.Text = TabText(
            $"Preview: {preview.Count} tab(s) will close; {preview.ExcludedPinnedCount} pinned tab(s) excluded.",
            $"預覽：將會關閉 {preview.Count} 個分頁；已排除 {preview.ExcludedPinnedCount} 個釘選分頁。") +
            (preview.Count == 0 ? TabText(" Nothing will change.", " 唔會有任何變更。") : "");
    }

    private async void ApplyTabClose_Click(object sender, RoutedEventArgs e)
    {
        if (_tabWorkspace is null || _currentTabClosePreview is not { IsValid: true, Count: > 0 } preview) return;
        var decision = MessageBox.Show(
            TabMessage(
                $"Close the {preview.Count} previewed tab(s)? Pending settings are saved first, and pinned tabs remain protected unless explicitly included.",
                $"關閉預覽中嘅 {preview.Count} 個分頁？系統會先儲存待處理設定；除非明確包括，否則釘選分頁繼續受保護。"),
            TabText("Close previewed tabs", "關閉預覽分頁"),
            MessageBoxButton.YesNo, MessageBoxImage.Warning);
        if (decision != MessageBoxResult.Yes) return;
        if (!await SaveWorkspaceBeforeCloseAsync()) return;
        if (!_tabWorkspace.ApplyClosePreview(preview, _settings.LanguageMode))
        {
            RefreshTabClosePreview();
            ShowToast("warn", TabText("Tab close preview changed", "分頁關閉預覽已變更"),
                TabMessage("The workspace changed after the preview, so no tabs were closed. Review the refreshed count and try again.", "預覽後工作區有變更，所以冇關閉任何分頁。請檢查更新後數量再試。"));
            return;
        }

        var closed = preview.Count;
        _settings.TabWorkspace = _tabWorkspace.State;
        RefreshTabWorkspaceVisuals(reloadSearchControls: false);
        RefreshTabSearchResults();
        RefreshTabClosePreview();
        PersistTabWorkspaceNow();
        ShowToast("success", TabText("Tabs closed", "分頁已關閉"),
            TabMessage($"Closed {closed} tab(s). Use All tabs to reopen any page.", $"已關閉 {closed} 個分頁。可用「全部分頁」重新開啟任何頁面。"));
    }
}
