using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using WorldDownloaderManager;
using Xunit;

namespace WorldDownloaderManager.Tests;

public sealed class TabWorkspaceServiceTests
{
    [Fact]
    public void DefaultsCreateStablePinnedWorkspace()
    {
        var service = new TabWorkspaceService(null);

        Assert.Equal(AppTabCatalog.DownloaderId, service.State.SelectedTabId);
        Assert.Equal(AppTabCatalog.Definitions.Count, service.State.Tabs.Count);
        Assert.Equal(AppTabCatalog.Definitions.Select(definition => definition.Id),
            service.OrderedTabs().Select(tab => tab.Id));
        Assert.True(service.State.Tabs.Single(tab => tab.Id == AppTabCatalog.DownloaderId).IsPinned);
        Assert.All(service.State.Tabs, tab => Assert.True(tab.IsOpen));
    }

    [Fact]
    public void NormalizationRepairsCorruptAndDuplicateState()
    {
        var source = new TabWorkspaceSettings
        {
            SelectedTabId = "missing",
            Revision = -50,
            Groups = new List<TabGroupState>
            {
                new() { Id = "tools", Name = "  Tools  ", Color = "#abcdef", Order = 9 },
                new() { Id = "tools", Name = "Duplicate", Color = "not-a-colour", Order = 0 },
            },
            Tabs = new List<TabState>
            {
                new() { Id = AppTabCatalog.SettingsId, Order = 7, IsOpen = false, GroupId = "tools" },
                new() { Id = AppTabCatalog.SettingsId, Order = 0, IsOpen = true },
                new() { Id = AppTabCatalog.DownloaderId, Order = 8, IsOpen = false, IsPinned = true },
                new() { Id = AppTabCatalog.HistoryId, Order = -2, IsOpen = false, GroupId = "missing" },
                new() { Id = "future-tab", Order = 1, IsOpen = true },
            },
        };

        var normalized = TabWorkspaceService.Normalize(source);

        Assert.Equal(0, normalized.Revision);
        Assert.Equal(AppTabCatalog.Definitions.Count, normalized.Tabs.Count);
        Assert.Single(normalized.Groups);
        Assert.Equal("Tools", normalized.Groups[0].Name);
        Assert.Equal("#ABCDEF", normalized.Groups[0].Color);
        Assert.Equal("tools", normalized.Tabs.Single(tab => tab.Id == AppTabCatalog.SettingsId).GroupId);
        Assert.Null(normalized.Tabs.Single(tab => tab.Id == AppTabCatalog.HistoryId).GroupId);
        Assert.Contains(normalized.SelectedTabId, normalized.Tabs.Where(tab => tab.IsOpen).Select(tab => tab.Id));
        Assert.Equal(Enumerable.Range(0, normalized.Tabs.Count), normalized.Tabs.Select(tab => tab.Order));
        Assert.DoesNotContain(normalized.Tabs, tab => tab.Id == "future-tab");
    }

    [Fact]
    public void SettingsRoundTripPersistsCompleteWorkspaceState()
    {
        var service = new TabWorkspaceService(null);
        var group = service.CreateGroup("Research", "#12345678");
        Assert.True(service.AssignToGroup(AppTabCatalog.ChangelogId, group));
        Assert.True(service.ToggleGroupCollapsed(group));
        Assert.True(service.TogglePin(AppTabCatalog.SettingsId));
        service.ReplaceSearchState(TabSearchScope.Master,
            new TabSearchState { Query = "更新", UseRegex = true, Flags = "im" });

        var settings = new Settings { TabWorkspace = service.State };
        var json = settings.ToJson();
        var restored = Settings.FromJson(json);

        Assert.Equal(service.State.SelectedTabId, restored.TabWorkspace.SelectedTabId);
        Assert.Equal(service.State.Revision, restored.TabWorkspace.Revision);
        Assert.Equal("Research", Assert.Single(restored.TabWorkspace.Groups).Name);
        Assert.True(restored.TabWorkspace.Groups[0].IsCollapsed);
        Assert.Equal(group, restored.TabWorkspace.Tabs.Single(
            tab => tab.Id == AppTabCatalog.ChangelogId).GroupId);
        Assert.DoesNotContain("更新", json);
        Assert.Equal("", restored.TabWorkspace.MasterSearch.Query);
        Assert.True(restored.TabWorkspace.MasterSearch.UseRegex);
        Assert.Equal("im", restored.TabWorkspace.MasterSearch.Flags);
    }

    [Fact]
    public void PinAndMoveStayInsideProtectedRegions()
    {
        var service = new TabWorkspaceService(null);
        Assert.True(service.TogglePin(AppTabCatalog.SettingsId));
        Assert.True(service.MoveTab(AppTabCatalog.SettingsId, -1));

        var pinned = service.OrderedTabs().Where(tab => tab.IsPinned).ToArray();
        Assert.Equal(new[] { AppTabCatalog.SettingsId, AppTabCatalog.DownloaderId },
            pinned.Select(tab => tab.Id));
        Assert.False(service.MoveTabBefore(AppTabCatalog.HistoryId, AppTabCatalog.DownloaderId));
        Assert.Equal(Enumerable.Range(0, service.State.Tabs.Count), service.OrderedTabs().Select(tab => tab.Order));
    }

    [Fact]
    public void GroupLifecyclePersistsMembershipCollapseAndActivation()
    {
        var service = new TabWorkspaceService(null);
        var group = service.CreateGroup("Operations", "#010203");
        Assert.True(service.AssignToGroup(AppTabCatalog.HistoryId, group));
        Assert.True(service.UpdateGroup(group, "World operations", "#AABBCCDD"));
        Assert.True(service.ToggleGroupCollapsed(group));

        var history = service.State.Tabs.Single(tab => tab.Id == AppTabCatalog.HistoryId);
        Assert.False(service.IsVisibleInStrip(history));
        Assert.True(service.Activate(AppTabCatalog.HistoryId));
        Assert.True(service.IsVisibleInStrip(history));
        Assert.False(service.State.Groups.Single(item => item.Id == group).IsCollapsed);
        Assert.Equal(AppTabCatalog.HistoryId, service.State.SelectedTabId);

        Assert.True(service.DeleteGroup(group));
        Assert.Null(service.State.Tabs.Single(tab => tab.Id == AppTabCatalog.HistoryId).GroupId);
        Assert.Empty(service.State.GroupTabSearches);
    }

    [Fact]
    public void FourSearchScopesKeepIndependentStateAndLocationMetadata()
    {
        var service = new TabWorkspaceService(null);
        var group = service.CreateGroup("Operations", "#123456");
        service.AssignToGroup(AppTabCatalog.HistoryId, group);
        service.AssignToGroup(AppTabCatalog.NotificationsId, group);
        service.CloseTab(AppTabCatalog.NotificationsId);

        service.ReplaceSearchState(TabSearchScope.CurrentStrip,
            new TabSearchState { Query = "settings" });
        service.ReplaceSearchState(TabSearchScope.GroupTabs,
            new TabSearchState { Query = "history" }, group);
        service.ReplaceSearchState(TabSearchScope.GroupNames,
            new TabSearchState { Query = "opera" });
        service.ReplaceSearchState(TabSearchScope.Master,
            new TabSearchState { Query = "closed" });

        Assert.Equal(AppTabCatalog.SettingsId,
            Assert.Single(service.Search(TabSearchScope.CurrentStrip, "English").Hits).Id);
        var groupHit = Assert.Single(service.Search(TabSearchScope.GroupTabs, "English", group).Hits);
        Assert.Equal(AppTabCatalog.HistoryId, groupHit.Id);
        Assert.Equal("Operations", groupHit.GroupName);
        Assert.Equal(group,
            Assert.Single(service.Search(TabSearchScope.GroupNames, "English").Hits).Id);
        var closedHit = Assert.Single(service.Search(TabSearchScope.Master, "English").Hits);
        Assert.Equal(AppTabCatalog.NotificationsId, closedHit.Id);
        Assert.False(closedHit.IsOpen);
    }

    [Fact]
    public void SearchSupportsUnicodeRegexAndReportsInvalidPatternsWithoutPartialHits()
    {
        var service = new TabWorkspaceService(null);
        service.ReplaceSearchState(TabSearchScope.Master,
            new TabSearchState { Query = "正則.*建構器", UseRegex = true, Flags = "i" });

        var valid = service.Search(TabSearchScope.Master, "Cantonese");
        Assert.True(valid.IsValid);
        Assert.Equal(AppTabCatalog.RegexBuilderId, Assert.Single(valid.Hits).Id);

        service.ReplaceSearchState(TabSearchScope.Master,
            new TabSearchState { Query = "(", UseRegex = true, Flags = "i" });
        var invalid = service.Search(TabSearchScope.Master, "Bilingual");
        Assert.False(invalid.IsValid);
        Assert.NotNull(invalid.Error);
        Assert.Empty(invalid.Hits);
    }

    [Fact]
    public void ClosePreviewBlocksEmptyInvalidAndStaleOperations()
    {
        var service = new TabWorkspaceService(null);
        Assert.False(service.PreviewClose("English").IsValid);

        service.ReplaceCloseSearch(new TabCloseSearchState
        {
            Query = "(",
            UseRegex = true,
        });
        Assert.False(service.PreviewClose("English").IsValid);

        service.ReplaceCloseSearch(new TabCloseSearchState { Query = "er" });
        var preview = service.PreviewClose("English");
        Assert.True(preview.IsValid);
        Assert.Contains(AppTabCatalog.DownloaderId, service.State.Tabs.Where(tab => tab.IsPinned).Select(tab => tab.Id));
        Assert.DoesNotContain(AppTabCatalog.DownloaderId, preview.TabIds);
        Assert.Equal(1, preview.ExcludedPinnedCount);

        service.TogglePin(AppTabCatalog.SettingsId);
        Assert.False(service.ApplyClosePreview(preview, "English"));
    }

    [Fact]
    public void CloseContainingAndNotContainingUseVisibleLabelsAndKeepOneTabOpen()
    {
        var service = new TabWorkspaceService(null);
        service.ReplaceCloseSearch(new TabCloseSearchState { Query = "History" });
        var containing = service.PreviewClose("English");
        Assert.Equal(new[] { AppTabCatalog.HistoryId }, containing.TabIds);
        Assert.True(service.ApplyClosePreview(containing, "English"));
        Assert.False(service.State.Tabs.Single(tab => tab.Id == AppTabCatalog.HistoryId).IsOpen);

        service.ReplaceCloseSearch(new TabCloseSearchState
        {
            Query = "Settings",
            CloseNotContaining = true,
            IncludePinned = false,
        });
        var notContaining = service.PreviewClose("English");
        Assert.True(notContaining.IsValid);
        Assert.DoesNotContain(AppTabCatalog.SettingsId, notContaining.TabIds);
        Assert.DoesNotContain(AppTabCatalog.DownloaderId, notContaining.TabIds);
        Assert.True(notContaining.ExcludedPinnedCount > 0);

        foreach (var tab in service.State.Tabs.Where(tab => tab.IsOpen && !tab.IsPinned && tab.Id != AppTabCatalog.SettingsId).ToArray())
            service.CloseTab(tab.Id);
        Assert.True(service.CloseTab(AppTabCatalog.SettingsId));
        Assert.False(service.CloseTab(AppTabCatalog.DownloaderId, includePinned: true));
        Assert.Single(service.State.Tabs, tab => tab.IsOpen);
    }

    [Fact]
    public void BulkClosePreservesAnUnrelatedSelectedTab()
    {
        var service = new TabWorkspaceService(null);
        Assert.True(service.Activate(AppTabCatalog.SettingsId));
        service.ReplaceCloseSearch(new TabCloseSearchState { Query = "History" });

        var preview = service.PreviewClose("English");
        Assert.True(service.ApplyClosePreview(preview, "English"));

        Assert.Equal(AppTabCatalog.SettingsId, service.State.SelectedTabId);
        Assert.False(service.State.Tabs.Single(tab => tab.Id == AppTabCatalog.HistoryId).IsOpen);
    }

    [Fact]
    public void SearchResultMetadataFollowsTheLanguageMode()
    {
        var service = new TabWorkspaceService(null);

        var cantonese = service.Search(TabSearchScope.Master, "Cantonese").Hits.Single(
            hit => hit.Id == AppTabCatalog.DownloaderId);
        var bilingual = service.Search(TabSearchScope.Master, "Bilingual").Hits.Single(
            hit => hit.Id == AppTabCatalog.DownloaderId);

        Assert.Contains("下載器", cantonese.DisplayText);
        Assert.Contains("已釘選", cantonese.DisplayText);
        Assert.DoesNotContain("pinned", cantonese.DisplayText);
        Assert.Contains("pinned", bilingual.DisplayText);
        Assert.Contains("已釘選", bilingual.DisplayText);
    }

    [Fact]
    public void BulkCloseRecomputesCandidatesAndRejectsTamperingOrLanguageDrift()
    {
        var service = new TabWorkspaceService(null);
        service.ReplaceCloseSearch(new TabCloseSearchState { Query = "History" });
        var legitimate = service.PreviewClose("English");
        var forged = new TabClosePreview(
            true,
            null,
            legitimate.TabIds.Concat(new[] { AppTabCatalog.DownloaderId }),
            legitimate.ExcludedPinnedCount,
            legitimate.StateRevision);

        Assert.False(service.ApplyClosePreview(forged, "English"));
        Assert.True(service.State.Tabs.Single(tab => tab.Id == AppTabCatalog.DownloaderId).IsOpen);
        Assert.True(service.State.Tabs.Single(tab => tab.Id == AppTabCatalog.HistoryId).IsOpen);

        service.ReplaceCloseSearch(new TabCloseSearchState { Query = "設定" });
        var cantonese = service.PreviewClose("Cantonese");
        Assert.Equal(new[] { AppTabCatalog.SettingsId }, cantonese.TabIds);
        Assert.False(service.ApplyClosePreview(cantonese, "English"));

        service.ReplaceCloseSearch(new TabCloseSearchState { Query = "History" });
        var beforeDirectMutation = service.PreviewClose("English");
        service.State.Tabs.Single(tab => tab.Id == AppTabCatalog.HistoryId).IsPinned = true;
        Assert.False(service.ApplyClosePreview(beforeDirectMutation, "English"));
    }

    [Fact]
    public void SelectedTabAlwaysRemainsVisibleAcrossCollapsedGroupMutations()
    {
        var service = new TabWorkspaceService(null);
        var group = service.CreateGroup("Collapsed", "#123456");
        Assert.True(service.ToggleGroupCollapsed(group));
        Assert.True(service.Activate(AppTabCatalog.SettingsId));
        Assert.True(service.AssignToGroup(AppTabCatalog.SettingsId, group));

        var settings = service.State.Tabs.Single(tab => tab.Id == AppTabCatalog.SettingsId);
        Assert.Equal(AppTabCatalog.SettingsId, service.State.SelectedTabId);
        Assert.True(service.IsVisibleInStrip(settings));
        Assert.False(service.State.Groups.Single(item => item.Id == group).IsCollapsed);

        Assert.True(service.AssignToGroup(AppTabCatalog.DownloaderId, group));
        Assert.True(service.ToggleGroupCollapsed(group));
        Assert.True(service.Activate(AppTabCatalog.DownloaderId));
        Assert.True(service.ToggleGroupCollapsed(group));
        Assert.True(service.TogglePin(AppTabCatalog.DownloaderId));
        var downloader = service.State.Tabs.Single(tab => tab.Id == AppTabCatalog.DownloaderId);
        Assert.True(service.IsVisibleInStrip(downloader));
        Assert.False(service.State.Groups.Single(item => item.Id == group).IsCollapsed);
    }

    [Fact]
    public void NormalizationExpandsThePersistedSelectedTabsCollapsedGroup()
    {
        var state = new TabWorkspaceSettings
        {
            SelectedTabId = AppTabCatalog.HistoryId,
            Groups = new List<TabGroupState>
            {
                new() { Id = "archive", Name = "Archive", IsCollapsed = true },
            },
            Tabs = new List<TabState>
            {
                new() { Id = AppTabCatalog.DownloaderId, Order = 0, IsOpen = true, IsPinned = true },
                new() { Id = AppTabCatalog.HistoryId, Order = 1, IsOpen = true, GroupId = "archive" },
            },
        };

        var service = new TabWorkspaceService(state);

        Assert.Equal(AppTabCatalog.HistoryId, service.State.SelectedTabId);
        Assert.False(Assert.Single(service.State.Groups).IsCollapsed);
        Assert.True(service.IsVisibleInStrip(service.State.Tabs.Single(tab => tab.Id == AppTabCatalog.HistoryId)));
    }

    [Fact]
    public void GroupNameSearchDoesNotMatchTabOnlyMetadata()
    {
        var service = new TabWorkspaceService(null);
        var group = service.CreateGroup("Operations", "#123456");
        service.ReplaceSearchState(TabSearchScope.GroupNames, new TabSearchState { Query = "open" });
        Assert.Empty(service.Search(TabSearchScope.GroupNames, "English").Hits);
        service.ReplaceSearchState(TabSearchScope.GroupNames, new TabSearchState { Query = "regular" });
        Assert.Empty(service.Search(TabSearchScope.GroupNames, "English").Hits);
        service.ReplaceSearchState(TabSearchScope.GroupNames, new TabSearchState { Query = "Operations" });
        Assert.Equal(group, Assert.Single(service.Search(TabSearchScope.GroupNames, "English").Hits).Id);
    }

    [Fact]
    public void StepwiseMoveSkipsClosedAndCollapsedTabs()
    {
        var service = new TabWorkspaceService(null);
        Assert.True(service.CloseTab(AppTabCatalog.RegexBuilderId));
        var group = service.CreateGroup("Hidden", "#123456");
        Assert.True(service.AssignToGroup(AppTabCatalog.ChangelogId, group));
        Assert.True(service.ToggleGroupCollapsed(group));

        Assert.True(service.MoveTab(AppTabCatalog.HistoryId, -1));

        var visibleRegular = service.OrderedTabs(includeClosed: false)
            .Where(service.IsVisibleInStrip)
            .Where(tab => !tab.IsPinned)
            .Select(tab => tab.Id)
            .ToArray();
        Assert.Equal(new[]
        {
            AppTabCatalog.HistoryId,
            AppTabCatalog.SettingsId,
            AppTabCatalog.NotificationsId,
        }, visibleRegular);
    }

    [Fact]
    public void RuntimeSearchRejectsRatherThanSilentlyTruncatingOversizedQueries()
    {
        var service = new TabWorkspaceService(null);
        var exact = new string('a', RegexBuilderService.MaxPatternLength);
        service.ReplaceSearchState(TabSearchScope.Master, new TabSearchState { Query = exact });
        Assert.Equal(exact, service.State.MasterSearch.Query);

        var oversized = new string('a', RegexBuilderService.MaxPatternLength + 1);
        var searchError = Assert.Throws<ArgumentException>(() => service.ReplaceSearchState(
            TabSearchScope.Master, new TabSearchState { Query = oversized }));
        var closeError = Assert.Throws<ArgumentException>(() => service.ReplaceCloseSearch(
            new TabCloseSearchState { Query = oversized }));
        Assert.Contains(RegexBuilderService.MaxPatternLength.ToString(), searchError.Message);
        Assert.Contains(RegexBuilderService.MaxPatternLength.ToString(), closeError.Message);
    }

    [Fact]
    public void TabAppearanceValuesAreBoundedDuringNormalization()
    {
        var state = new TabWorkspaceSettings
        {
            Tabs = new List<TabState>
            {
                new()
                {
                    Id = AppTabCatalog.DownloaderId,
                    IsOpen = true,
                    IsPinned = true,
                    Appearance = new TabAppearanceSettings
                    {
                        FontFamily = new string('F', 500),
                        FontSize = 999,
                        FontWeight = "  Bold  ",
                        LetterSpacing = -999,
                        LineHeight = 4,
                    },
                },
            },
        };

        var appearance = TabWorkspaceService.Normalize(state).Tabs.Single(
            tab => tab.Id == AppTabCatalog.DownloaderId).Appearance;

        Assert.Equal(120, appearance.FontFamily.Length);
        Assert.Null(appearance.FontSize);
        Assert.Equal("Bold", appearance.FontWeight);
        Assert.Equal(-20, appearance.LetterSpacing);
        Assert.Null(appearance.LineHeight);
    }
}
