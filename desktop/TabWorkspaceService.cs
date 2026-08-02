using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Linq;
using System.Text.Json.Serialization;

namespace WorldDownloaderManager;

public sealed record AppTabDefinition(
    string Id,
    string EnglishLabel,
    string CantoneseLabel,
    int DefaultOrder,
    bool DefaultPinned = false)
{
    public string LabelFor(string? languageMode) => languageMode switch
    {
        "Cantonese" => CantoneseLabel,
        "Bilingual" => EnglishLabel + " · " + CantoneseLabel,
        _ => EnglishLabel,
    };
}

public static class AppTabCatalog
{
    public const string DownloaderId = "downloader";
    public const string SettingsId = "settings";
    public const string RegexBuilderId = "regex-builder";
    public const string ChangelogId = "changelog";
    public const string HistoryId = "history";
    public const string NotificationsId = "notifications";

    public static IReadOnlyList<AppTabDefinition> Definitions { get; } =
        new ReadOnlyCollection<AppTabDefinition>(new[]
        {
            new AppTabDefinition(DownloaderId, "Downloader", "下載器", 0, DefaultPinned: true),
            new AppTabDefinition(SettingsId, "Settings", "設定", 1),
            new AppTabDefinition(RegexBuilderId, "Regex builder", "正則表達式建構器", 2),
            new AppTabDefinition(ChangelogId, "Changelog", "更新記錄", 3),
            new AppTabDefinition(HistoryId, "History", "版本記錄", 4),
            new AppTabDefinition(NotificationsId, "Notifications", "通知", 5),
        });

    public static AppTabDefinition? Find(string? id) => Definitions.FirstOrDefault(
        definition => string.Equals(definition.Id, id, StringComparison.OrdinalIgnoreCase));
}

public sealed class TabWorkspaceSettings
{
    public string SelectedTabId { get; set; } = AppTabCatalog.DownloaderId;
    public long Revision { get; set; }
    public List<TabState> Tabs { get; set; } = new();
    public List<TabGroupState> Groups { get; set; } = new();
    public TabSearchState CurrentStripSearch { get; set; } = new();
    public Dictionary<string, TabSearchState> GroupTabSearches { get; set; } = new(StringComparer.Ordinal);
    public TabSearchState GroupNameSearch { get; set; } = new();
    public TabSearchState MasterSearch { get; set; } = new();
    public TabCloseSearchState CloseSearch { get; set; } = new();
}

public sealed class TabState
{
    public string Id { get; set; } = "";
    public int Order { get; set; }
    public bool IsOpen { get; set; } = true;
    public bool IsPinned { get; set; }
    public string? GroupId { get; set; }
    public string? CustomLabel { get; set; }
    public TabAppearanceSettings Appearance { get; set; } = new();
}

public sealed class TabGroupState
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#6750A4";
    public int Order { get; set; }
    public bool IsCollapsed { get; set; }
}

/// <summary>
/// Persisted tab typography and decoration. The workspace keeps this data now so a later visual
/// editor can be added without another settings migration or losing user-created tab layouts.
/// </summary>
public sealed class TabAppearanceSettings
{
    public string FontFamily { get; set; } = "";
    public double? FontSize { get; set; }
    public string FontWeight { get; set; } = "";
    public bool Italic { get; set; }
    public bool Underline { get; set; }
    public bool Strikethrough { get; set; }
    public string Foreground { get; set; } = "";
    public string Highlight { get; set; } = "";
    public double LetterSpacing { get; set; }
    public double? LineHeight { get; set; }
}

public class TabSearchState
{
    [JsonIgnore]
    public string Query { get; set; } = "";
    public bool UseRegex { get; set; }
    public string Flags { get; set; } = "i";
}

public sealed class TabCloseSearchState : TabSearchState
{
    public bool CloseNotContaining { get; set; }
    public bool IncludePinned { get; set; }
}

public enum TabSearchScope
{
    CurrentStrip,
    GroupTabs,
    GroupNames,
    Master,
}

public enum TabSearchHitKind
{
    Tab,
    Group,
}

public sealed record TabSearchHit(
    TabSearchHitKind Kind,
    string Id,
    string Label,
    string? GroupId,
    string? GroupName,
    bool IsPinned,
    bool IsOpen,
    bool IsGroupCollapsed,
    string DisplayText);

public sealed record TabSearchResult(
    bool IsValid,
    string? Error,
    IReadOnlyList<TabSearchHit> Hits);

public sealed class TabClosePreview
{
    public TabClosePreview(
        bool isValid,
        string? error,
        IEnumerable<string> tabIds,
        int excludedPinnedCount,
        long stateRevision)
    {
        ArgumentNullException.ThrowIfNull(tabIds);
        IsValid = isValid;
        Error = error;
        TabIds = Array.AsReadOnly(tabIds.Distinct(StringComparer.Ordinal).ToArray());
        ExcludedPinnedCount = Math.Max(0, excludedPinnedCount);
        StateRevision = Math.Max(0, stateRevision);
    }

    public bool IsValid { get; }
    public string? Error { get; }
    public IReadOnlyList<string> TabIds { get; }
    public int ExcludedPinnedCount { get; }
    public long StateRevision { get; }
    public int Count => TabIds.Count;
}

/// <summary>
/// Pure, persistable browser-style tab workspace logic. WPF owns presentation and close prompts;
/// this service owns invariants, deterministic ordering, bounded searching and close preflight.
/// </summary>
public sealed class TabWorkspaceService
{
    private const int MaximumLabelLength = 120;
    private const int MaximumGroupNameLength = 80;
    private const int MaximumGroupCount = 64;

    public TabWorkspaceService(TabWorkspaceSettings? settings)
    {
        State = Normalize(settings);
    }

    // The mutable aggregate stays assembly-internal so all production changes flow through this
    // service's invariant-preserving methods. MainWindow owns it on the WPF dispatcher thread.
    internal TabWorkspaceSettings State { get; private set; }

    public static TabWorkspaceSettings Normalize(TabWorkspaceSettings? source)
    {
        source ??= new TabWorkspaceSettings();

        var groups = NormalizeGroups(source.Groups);
        var groupIds = groups.Select(group => group.Id).ToHashSet(StringComparer.Ordinal);
        var sourceTabs = (source.Tabs ?? new List<TabState>())
            .Select((tab, sourceIndex) => (tab, sourceIndex))
            .Where(pair => pair.tab is not null)
            .GroupBy(pair => pair.tab.Id ?? "", StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var tabs = new List<TabState>(AppTabCatalog.Definitions.Count);
        foreach (var definition in AppTabCatalog.Definitions)
        {
            if (!sourceTabs.TryGetValue(definition.Id, out var existing))
            {
                tabs.Add(new TabState
                {
                    Id = definition.Id,
                    Order = definition.DefaultOrder,
                    IsOpen = true,
                    IsPinned = definition.DefaultPinned,
                });
                continue;
            }

            var tab = existing.tab;
            tabs.Add(new TabState
            {
                Id = definition.Id,
                Order = tab.Order,
                IsOpen = tab.IsOpen,
                IsPinned = tab.IsPinned,
                GroupId = tab.GroupId is not null && groupIds.Contains(tab.GroupId) ? tab.GroupId : null,
                CustomLabel = CleanOptional(tab.CustomLabel, MaximumLabelLength),
                Appearance = NormalizeAppearance(tab.Appearance),
            });
        }

        tabs = tabs
            .Select((tab, index) => (tab, index))
            .OrderByDescending(pair => pair.tab.IsPinned)
            .ThenBy(pair => pair.tab.Order)
            .ThenBy(pair => pair.index)
            .Select(pair => pair.tab)
            .ToList();
        for (var index = 0; index < tabs.Count; index++) tabs[index].Order = index;

        if (tabs.All(tab => !tab.IsOpen))
            tabs.First(tab => tab.Id == AppTabCatalog.DownloaderId).IsOpen = true;

        var selected = tabs.FirstOrDefault(tab =>
            tab.IsOpen && string.Equals(tab.Id, source.SelectedTabId, StringComparison.OrdinalIgnoreCase))?.Id
            ?? tabs.First(tab => tab.IsOpen).Id;
        var selectedState = tabs.First(tab => tab.Id == selected);
        if (!IsVisibleInStrip(selectedState, groups) && selectedState.GroupId is not null)
        {
            var selectedGroup = groups.FirstOrDefault(group => group.Id == selectedState.GroupId);
            if (selectedGroup is not null) selectedGroup.IsCollapsed = false;
        }

        var groupSearches = new Dictionary<string, TabSearchState>(StringComparer.Ordinal);
        foreach (var group in groups)
        {
            TabSearchState? state = null;
            if (source.GroupTabSearches is not null)
                source.GroupTabSearches.TryGetValue(group.Id, out state);
            groupSearches[group.Id] = NormalizeSearch(state);
        }

        return new TabWorkspaceSettings
        {
            SelectedTabId = selected,
            Revision = Math.Max(0, source.Revision),
            Tabs = tabs,
            Groups = groups,
            CurrentStripSearch = NormalizeSearch(source.CurrentStripSearch),
            GroupTabSearches = groupSearches,
            GroupNameSearch = NormalizeSearch(source.GroupNameSearch),
            MasterSearch = NormalizeSearch(source.MasterSearch),
            CloseSearch = NormalizeCloseSearch(source.CloseSearch),
        };
    }

    public IReadOnlyList<TabState> OrderedTabs(bool includeClosed = true) => State.Tabs
        .Where(tab => includeClosed || tab.IsOpen)
        .OrderBy(tab => tab.Order)
        .ToArray();

    public string VisibleLabel(string tabId, string? languageMode)
    {
        var tab = FindTab(tabId);
        if (!string.IsNullOrWhiteSpace(tab?.CustomLabel)) return tab.CustomLabel!;
        return AppTabCatalog.Find(tabId)?.LabelFor(languageMode) ?? tabId;
    }

    public bool Activate(string tabId)
    {
        var tab = FindTab(tabId);
        if (tab is null) return false;
        tab.IsOpen = true;
        if (tab.GroupId is not null)
        {
            var group = FindGroup(tab.GroupId);
            if (group is not null) group.IsCollapsed = false;
        }
        State.SelectedTabId = tab.Id;
        CommitMutation();
        return true;
    }

    public bool TogglePin(string tabId)
    {
        var tab = FindTab(tabId);
        if (tab is null) return false;
        tab.IsPinned = !tab.IsPinned;
        CommitMutation();
        return true;
    }

    public bool MoveTab(string tabId, int direction)
    {
        if (direction == 0) return false;
        var tab = FindTab(tabId);
        if (tab is null) return false;
        var region = OrderedTabs(includeClosed: false)
            .Where(IsVisibleInStrip)
            .Where(candidate => candidate.IsPinned == tab.IsPinned)
            .ToList();
        var index = region.FindIndex(candidate => candidate.Id == tab.Id);
        if (index < 0) return false;
        var targetIndex = Math.Clamp(index + Math.Sign(direction), 0, region.Count - 1);
        if (targetIndex == index) return false;
        return MoveTabBeforeOrAfter(tab, region[targetIndex], targetIndex > index);
    }

    public bool MoveTabBefore(string tabId, string targetTabId)
        => MoveTabRelative(tabId, targetTabId, after: false);

    public bool MoveTabRelative(string tabId, string targetTabId, bool after)
    {
        var tab = FindTab(tabId);
        var target = FindTab(targetTabId);
        if (tab is null || target is null || tab.Id == target.Id || tab.IsPinned != target.IsPinned) return false;
        return MoveTabBeforeOrAfter(tab, target, after);
    }

    public bool MoveTabToRegionEnd(string tabId)
    {
        var tab = FindTab(tabId);
        if (tab is null) return false;
        var last = OrderedTabs(includeClosed: false)
            .Where(IsVisibleInStrip)
            .Last(candidate => candidate.IsPinned == tab.IsPinned);
        return last.Id != tab.Id && MoveTabBeforeOrAfter(tab, last, after: true);
    }

    public string CreateGroup(string name, string? color = null)
    {
        if (State.Groups.Count >= MaximumGroupCount)
            throw new InvalidOperationException($"A workspace can contain at most {MaximumGroupCount} groups.");
        var cleanedName = CleanRequired(name, MaximumGroupNameLength, "A group name is required.");
        var id = "group-" + Guid.NewGuid().ToString("N", CultureInfo.InvariantCulture);
        State.Groups.Add(new TabGroupState
        {
            Id = id,
            Name = cleanedName,
            Color = NormalizeHexColor(color),
            Order = State.Groups.Count,
        });
        State.GroupTabSearches[id] = new TabSearchState();
        CommitMutation();
        return id;
    }

    public bool UpdateGroup(string groupId, string name, string? color)
    {
        var group = FindGroup(groupId);
        if (group is null) return false;
        group.Name = CleanRequired(name, MaximumGroupNameLength, "A group name is required.");
        group.Color = NormalizeHexColor(color);
        CommitMutation();
        return true;
    }

    public bool MoveGroup(string groupId, int direction)
    {
        if (direction == 0) return false;
        var groups = State.Groups.OrderBy(group => group.Order).ToList();
        var index = groups.FindIndex(group => group.Id == groupId);
        if (index < 0) return false;
        var target = Math.Clamp(index + Math.Sign(direction), 0, groups.Count - 1);
        if (target == index) return false;
        (groups[index], groups[target]) = (groups[target], groups[index]);
        for (var position = 0; position < groups.Count; position++) groups[position].Order = position;
        State.Groups = groups;
        CommitMutation();
        return true;
    }

    public bool ToggleGroupCollapsed(string groupId)
    {
        var group = FindGroup(groupId);
        if (group is null) return false;
        return SetGroupCollapsed(groupId, !group.IsCollapsed);
    }

    public bool SetGroupCollapsed(string groupId, bool collapsed)
    {
        var group = FindGroup(groupId);
        if (group is null || group.IsCollapsed == collapsed) return false;
        group.IsCollapsed = collapsed;
        if (group.IsCollapsed)
        {
            var selected = FindTab(State.SelectedTabId);
            if (selected is { IsPinned: false } && selected.GroupId == group.Id)
            {
                var fallback = OrderedTabs(includeClosed: false).FirstOrDefault(IsVisibleInStrip);
                if (fallback is null)
                {
                    group.IsCollapsed = false;
                    return false;
                }
                State.SelectedTabId = fallback.Id;
            }
        }
        CommitMutation();
        return true;
    }

    public bool AssignToGroup(string tabId, string? groupId)
    {
        var tab = FindTab(tabId);
        if (tab is null || (groupId is not null && FindGroup(groupId) is null)) return false;
        if (string.Equals(tab.GroupId, groupId, StringComparison.Ordinal)) return false;
        tab.GroupId = groupId;
        CommitMutation();
        return true;
    }

    public bool DeleteGroup(string groupId)
    {
        var group = FindGroup(groupId);
        if (group is null) return false;
        foreach (var tab in State.Tabs.Where(tab => tab.GroupId == groupId)) tab.GroupId = null;
        State.Groups.Remove(group);
        State.GroupTabSearches.Remove(groupId);
        CommitMutation();
        return true;
    }

    public bool CloseTab(string tabId, bool includePinned = false)
    {
        var tab = FindTab(tabId);
        if (tab is null || !tab.IsOpen || (tab.IsPinned && !includePinned)) return false;
        if (State.Tabs.Count(candidate => candidate.IsOpen) <= 1) return false;
        tab.IsOpen = false;
        SelectFallbackAfterClose(tabId);
        CommitMutation();
        return true;
    }

    public TabSearchResult Search(TabSearchScope scope, string? languageMode, string? groupId = null)
    {
        var state = GetSearchState(scope, groupId);
        var candidates = BuildSearchCandidates(scope, languageMode, groupId);
        if (candidates is null)
            return new TabSearchResult(false, "Choose an existing group before searching its tabs.", Array.Empty<TabSearchHit>());

        if (string.IsNullOrWhiteSpace(state.Query))
            return new TabSearchResult(true, null, candidates);

        if (!state.UseRegex)
        {
            var plainHits = candidates.Where(hit => SearchableText(hit).Contains(
                state.Query, StringComparison.CurrentCultureIgnoreCase)).ToArray();
            return new TabSearchResult(true, null, plainHits);
        }

        var searchable = candidates.Select(SearchableText).ToArray();
        var evaluation = RegexBuilderService.EvaluateSearchSet(state.Query, state.Flags, searchable);
        if (!evaluation.IsValid)
            return new TabSearchResult(false, evaluation.Error, Array.Empty<TabSearchHit>());
        return new TabSearchResult(true, null, candidates.Where((_, index) => evaluation.Matches[index]).ToArray());
    }

    public IReadOnlyList<TabSearchHit> AllTabHits(string? languageMode) =>
        BuildSearchCandidates(TabSearchScope.Master, languageMode, null) ?? Array.Empty<TabSearchHit>();

    public IReadOnlyList<string> SearchSamples(
        TabSearchScope scope, string? languageMode, string? groupId = null) =>
        (BuildSearchCandidates(scope, languageMode, groupId) ?? Array.Empty<TabSearchHit>())
        .Select(SearchableText)
        .ToArray();

    public IReadOnlyList<string> CloseSearchSamples(string? languageMode) =>
        OrderedTabs(includeClosed: false)
            .Select(tab => VisibleLabel(tab.Id, languageMode))
            .ToArray();

    public TabClosePreview PreviewClose(string? languageMode)
    {
        var close = State.CloseSearch;
        if (string.IsNullOrWhiteSpace(close.Query))
            return InvalidClose("Enter text before previewing tabs to close.");

        var openTabs = OrderedTabs(includeClosed: false).ToArray();
        var labels = openTabs.Select(tab => VisibleLabel(tab.Id, languageMode)).ToArray();
        bool[] contains;
        if (close.UseRegex)
        {
            var evaluation = RegexBuilderService.EvaluateSearchSet(close.Query, close.Flags, labels);
            if (!evaluation.IsValid) return InvalidClose(evaluation.Error ?? "The regular expression is invalid.");
            contains = evaluation.Matches.ToArray();
        }
        else
        {
            contains = labels.Select(label => label.Contains(
                close.Query, StringComparison.CurrentCultureIgnoreCase)).ToArray();
        }

        var matches = new List<string>();
        var excludedPinned = 0;
        for (var index = 0; index < openTabs.Length; index++)
        {
            var selected = close.CloseNotContaining ? !contains[index] : contains[index];
            if (!selected) continue;
            if (openTabs[index].IsPinned && !close.IncludePinned)
            {
                excludedPinned++;
                continue;
            }
            matches.Add(openTabs[index].Id);
        }

        if (matches.Count >= openTabs.Length)
            return InvalidClose("At least one tab must remain open.");
        return new TabClosePreview(true, null, matches, excludedPinned, State.Revision);
    }

    public bool ApplyClosePreview(TabClosePreview preview, string? languageMode)
    {
        ArgumentNullException.ThrowIfNull(preview);
        if (!preview.IsValid || preview.StateRevision != State.Revision) return false;
        var current = PreviewClose(languageMode);
        if (!current.IsValid || current.StateRevision != preview.StateRevision ||
            current.ExcludedPinnedCount != preview.ExcludedPinnedCount ||
            !current.TabIds.SequenceEqual(preview.TabIds, StringComparer.Ordinal)) return false;
        var openCount = State.Tabs.Count(tab => tab.IsOpen);
        var candidates = current.TabIds
            .Select(FindTab)
            .Where(tab => tab is { IsOpen: true })
            .Cast<TabState>()
            .DistinctBy(tab => tab.Id)
            .ToArray();
        if (candidates.Length == 0 || candidates.Length >= openCount) return false;
        var selectedWasClosed = candidates.Any(tab => tab.Id == State.SelectedTabId);
        foreach (var tab in candidates) tab.IsOpen = false;
        if (selectedWasClosed) SelectFallbackAfterClose(State.SelectedTabId);
        CommitMutation();
        return true;
    }

    public void ReplaceSearchState(TabSearchScope scope, TabSearchState state, string? groupId = null)
    {
        ArgumentNullException.ThrowIfNull(state);
        ValidateRuntimeSearch(state.Query);
        var normalized = NormalizeSearch(state);
        switch (scope)
        {
            case TabSearchScope.CurrentStrip:
                State.CurrentStripSearch = normalized;
                break;
            case TabSearchScope.GroupTabs:
                if (groupId is null || FindGroup(groupId) is null)
                    throw new ArgumentException("An existing group is required.", nameof(groupId));
                State.GroupTabSearches[groupId] = normalized;
                break;
            case TabSearchScope.GroupNames:
                State.GroupNameSearch = normalized;
                break;
            case TabSearchScope.Master:
                State.MasterSearch = normalized;
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(scope));
        }
        CommitMutation();
    }

    public void ReplaceCloseSearch(TabCloseSearchState state)
    {
        ArgumentNullException.ThrowIfNull(state);
        ValidateRuntimeSearch(state.Query);
        State.CloseSearch = NormalizeCloseSearch(state);
        CommitMutation();
    }

    private static void ValidateRuntimeSearch(string? query)
    {
        if ((query?.Length ?? 0) > RegexBuilderService.MaxPatternLength)
            throw new ArgumentException(
                $"A tab search is limited to {RegexBuilderService.MaxPatternLength} characters.", nameof(query));
    }

    private IReadOnlyList<TabSearchHit>? BuildSearchCandidates(
        TabSearchScope scope, string? languageMode, string? groupId)
    {
        if (scope == TabSearchScope.GroupNames)
            return State.Groups.OrderBy(group => group.Order).Select(group => new TabSearchHit(
                TabSearchHitKind.Group, group.Id, group.Name, group.Id, group.Name,
                IsPinned: false, IsOpen: true, group.IsCollapsed,
                FormatGroupHit(group.Name, group.IsCollapsed, languageMode))).ToArray();

        if (scope == TabSearchScope.GroupTabs && (groupId is null || FindGroup(groupId) is null))
            return null;

        IEnumerable<TabState> tabs = scope switch
        {
            TabSearchScope.CurrentStrip => OrderedTabs(includeClosed: false).Where(IsVisibleInStrip),
            TabSearchScope.GroupTabs => OrderedTabs().Where(tab => tab.GroupId == groupId),
            TabSearchScope.Master => OrderedTabs(),
            _ => Array.Empty<TabState>(),
        };

        return tabs.Select(tab =>
        {
            var group = tab.GroupId is null ? null : FindGroup(tab.GroupId);
            var label = VisibleLabel(tab.Id, languageMode);
            return new TabSearchHit(
                TabSearchHitKind.Tab,
                tab.Id,
                label,
                tab.GroupId,
                group?.Name,
                tab.IsPinned,
                tab.IsOpen,
                group?.IsCollapsed == true,
                FormatTabHit(label, group?.Name, tab.IsPinned, tab.IsOpen, languageMode));
        }).ToArray();
    }

    public bool IsVisibleInStrip(TabState tab)
    {
        return IsVisibleInStrip(tab, State.Groups);
    }

    private static bool IsVisibleInStrip(TabState tab, IReadOnlyList<TabGroupState> groups)
    {
        if (!tab.IsOpen) return false;
        if (tab.IsPinned || tab.GroupId is null) return true;
        return groups.FirstOrDefault(group => group.Id == tab.GroupId)?.IsCollapsed != true;
    }

    private TabSearchState GetSearchState(TabSearchScope scope, string? groupId) => scope switch
    {
        TabSearchScope.CurrentStrip => State.CurrentStripSearch,
        TabSearchScope.GroupTabs when groupId is not null && State.GroupTabSearches.TryGetValue(groupId, out var state) => state,
        TabSearchScope.GroupTabs => new TabSearchState(),
        TabSearchScope.GroupNames => State.GroupNameSearch,
        TabSearchScope.Master => State.MasterSearch,
        _ => throw new ArgumentOutOfRangeException(nameof(scope)),
    };

    private static string SearchableText(TabSearchHit hit) => hit.Kind == TabSearchHitKind.Group
        ? string.Join('\n', new[]
        {
            hit.Label,
            "group",
            "群組",
            hit.IsGroupCollapsed ? "collapsed" : "expanded",
            hit.IsGroupCollapsed ? "已收合" : "已展開",
        })
        : string.Join('\n', new[]
        {
            hit.Label,
            hit.GroupName ?? "ungrouped",
            hit.IsPinned ? "pinned" : "regular",
            hit.IsOpen ? "open" : "closed",
            hit.IsGroupCollapsed ? "collapsed" : "expanded",
            hit.IsPinned ? "已釘選" : "一般",
            hit.IsOpen ? "開啟" : "已關閉",
            hit.IsGroupCollapsed ? "已收合" : "已展開",
        });

    private static string FormatGroupHit(string label, bool collapsed, string? languageMode)
    {
        var english = $"{label} · group · {(collapsed ? "collapsed" : "expanded")}";
        var cantonese = $"{label} · 群組 · {(collapsed ? "已收合" : "已展開")}";
        return languageMode switch
        {
            "Cantonese" => cantonese,
            "Bilingual" => $"{label} · group / 群組 · " +
                           $"{(collapsed ? "collapsed / 已收合" : "expanded / 已展開")}",
            _ => english,
        };
    }

    private static string FormatTabHit(
        string label,
        string? groupName,
        bool pinned,
        bool open,
        string? languageMode)
    {
        var locationEnglish = string.IsNullOrWhiteSpace(groupName) ? "ungrouped" : groupName;
        var locationCantonese = string.IsNullOrWhiteSpace(groupName) ? "未分組" : groupName;
        var english = $"{label} · {locationEnglish} · {(pinned ? "pinned" : "regular")} · {(open ? "open" : "closed")}";
        var cantonese = $"{label} · {locationCantonese} · {(pinned ? "已釘選" : "一般")} · {(open ? "開啟" : "已關閉")}";
        return languageMode switch
        {
            "Cantonese" => cantonese,
            "Bilingual" => $"{label} · {locationEnglish} / {locationCantonese} · " +
                           $"{(pinned ? "pinned / 已釘選" : "regular / 一般")} · " +
                           $"{(open ? "open / 開啟" : "closed / 已關閉")}",
            _ => english,
        };
    }

    private bool MoveTabBeforeOrAfter(TabState tab, TabState target, bool after)
    {
        var ordered = OrderedTabs().ToList();
        ordered.Remove(tab);
        var targetIndex = ordered.IndexOf(target);
        if (targetIndex < 0) return false;
        ordered.Insert(targetIndex + (after ? 1 : 0), tab);
        for (var position = 0; position < ordered.Count; position++) ordered[position].Order = position;
        State.Tabs = ordered;
        CommitMutation();
        return true;
    }

    private void SelectFallbackAfterClose(string closedTabId)
    {
        if (!string.Equals(State.SelectedTabId, closedTabId, StringComparison.Ordinal)) return;
        var fallback = OrderedTabs(includeClosed: false).FirstOrDefault(IsVisibleInStrip);
        if (fallback is null)
        {
            fallback = OrderedTabs(includeClosed: false).First();
            if (fallback.GroupId is not null && FindGroup(fallback.GroupId) is { } group)
                group.IsCollapsed = false;
        }
        State.SelectedTabId = fallback.Id;
    }

    private void CommitMutation()
    {
        var nextRevision = State.Revision == long.MaxValue ? 0 : State.Revision + 1;
        State = Normalize(State);
        State.Revision = nextRevision;
    }

    private TabState? FindTab(string? id) => State.Tabs.FirstOrDefault(
        tab => string.Equals(tab.Id, id, StringComparison.Ordinal));

    private TabGroupState? FindGroup(string? id) => State.Groups.FirstOrDefault(
        group => string.Equals(group.Id, id, StringComparison.Ordinal));

    private static List<TabGroupState> NormalizeGroups(List<TabGroupState>? source)
    {
        var normalized = (source ?? new List<TabGroupState>())
            .Where(group => group is not null)
            .Select((group, index) => new TabGroupState
            {
                Id = CleanOptional(group.Id, 80) ?? "group-" + Guid.NewGuid().ToString("N", CultureInfo.InvariantCulture),
                Name = CleanOptional(group.Name, MaximumGroupNameLength) ?? $"Group {index + 1}",
                Color = NormalizeHexColor(group.Color),
                Order = group.Order,
                IsCollapsed = group.IsCollapsed,
            })
            .GroupBy(group => group.Id, StringComparer.Ordinal)
            .Select(group => group.First())
            .OrderBy(group => group.Order)
            .ThenBy(group => group.Name, StringComparer.CurrentCultureIgnoreCase)
            .Take(MaximumGroupCount)
            .ToList();
        for (var index = 0; index < normalized.Count; index++) normalized[index].Order = index;
        return normalized;
    }

    private static TabAppearanceSettings NormalizeAppearance(TabAppearanceSettings? source) => new()
    {
        FontFamily = CleanOptional(source?.FontFamily, 120) ?? "",
        FontSize = source?.FontSize is >= 6 and <= 144 ? source.FontSize : null,
        FontWeight = CleanOptional(source?.FontWeight, 32) ?? "",
        Italic = source?.Italic == true,
        Underline = source?.Underline == true,
        Strikethrough = source?.Strikethrough == true,
        Foreground = CleanOptional(source?.Foreground, 120) ?? "",
        Highlight = CleanOptional(source?.Highlight, 120) ?? "",
        LetterSpacing = Math.Clamp(source?.LetterSpacing ?? 0, -20, 100),
        LineHeight = source?.LineHeight is >= 6 and <= 300 ? source.LineHeight : null,
    };

    private static TabSearchState NormalizeSearch(TabSearchState? source) => new()
    {
        Query = Truncate(source?.Query ?? "", RegexBuilderService.MaxPatternLength),
        UseRegex = source?.UseRegex == true,
        Flags = NormalizeFlags(source?.Flags),
    };

    private static TabCloseSearchState NormalizeCloseSearch(TabCloseSearchState? source) => new()
    {
        Query = Truncate(source?.Query ?? "", RegexBuilderService.MaxPatternLength),
        UseRegex = source?.UseRegex == true,
        Flags = NormalizeFlags(source?.Flags),
        CloseNotContaining = source?.CloseNotContaining == true,
        IncludePinned = source?.IncludePinned == true,
    };

    private static string NormalizeFlags(string? flags)
    {
        var output = new string((flags ?? "i")
            .Where(character => character is 'i' or 'm' or 's' or 'n')
            .Distinct()
            .ToArray());
        return output;
    }

    private static string NormalizeHexColor(string? color)
    {
        var value = color?.Trim() ?? "";
        if (value.Length is 7 or 9 && value[0] == '#' && value.Skip(1).All(Uri.IsHexDigit))
            return value.ToUpperInvariant();
        return "#6750A4";
    }

    private static string CleanRequired(string? value, int maximum, string error)
        => CleanOptional(value, maximum) ?? throw new ArgumentException(error, nameof(value));

    private static string? CleanOptional(string? value, int maximum)
    {
        var cleaned = value?.Trim();
        return string.IsNullOrEmpty(cleaned) ? null : Truncate(cleaned, maximum);
    }

    private static string Truncate(string value, int maximum) =>
        value.Length <= maximum ? value : value[..maximum];

    private TabClosePreview InvalidClose(string error) =>
        new(false, error, Array.Empty<string>(), 0, State.Revision);
}
