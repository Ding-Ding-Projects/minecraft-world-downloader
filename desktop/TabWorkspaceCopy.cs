using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;

namespace WorldDownloaderManager;

/// <summary>Static, non-humorous navigation copy for the browser-style tab workspace.</summary>
public static class TabWorkspaceCopy
{
    private static readonly IReadOnlyList<(string English, string Cantonese)> Entries = new[]
    {
        ("Workspace tabs", "工作區分頁"),
        ("Pin, group, reorder, find, close and reopen pages. Ctrl+Shift+P pins; Alt+Shift+Left/Right moves; Ctrl+W closes.",
            "釘選、分組、排序、搜尋、關閉同重新開啟頁面。Ctrl+Shift+P 釘選；Alt+Shift+左／右鍵移動；Ctrl+W 關閉。"),
        ("Pin", "釘選"),
        ("Pin or unpin selected tab", "釘選或取消釘選目前分頁"),
        ("Move selected tab left", "將目前分頁向左移"),
        ("Move selected tab right", "將目前分頁向右移"),
        ("Groups", "群組"),
        ("Manage tab groups", "管理分頁群組"),
        ("Find tabs", "搵分頁"),
        ("Open tab search and bulk close", "開啟分頁搜尋同批量關閉"),
        ("All tabs", "全部分頁"),
        ("Open all tabs and overflow list", "開啟全部分頁及更多分頁清單"),
        ("Tab groups", "分頁群組"),
        ("Tab workspace controls", "分頁工作區控制項"),
        ("Find and close tabs", "搜尋及關閉分頁"),
        ("Four searches keep independent session state. Plain text is the default; each field has its own full anchored .NET regex builder. Search text, regex patterns and samples are never saved.",
            "四種搜尋各自保留今次執行階段狀態。預設使用純文字；每個欄位都有自己完整、錨定嘅 .NET 正則表達式建構器。搜尋文字、regex pattern 同 sample 絕不儲存。"),
        ("Close tab search", "關閉分頁搜尋"),
        ("Tab search scopes", "分頁搜尋範圍"),
        ("Strip", "分頁列"),
        ("Current tab strip search", "目前分頁列搜尋"),
        ("Search the current tab strip", "搜尋目前分頁列"),
        ("Use regex for current strip search", "目前分頁列搜尋使用正則表達式"),
        ("Open regex builder for current strip search", "開啟目前分頁列搜尋嘅正則表達式建構器"),
        ("Current strip search results", "目前分頁列搜尋結果"),
        ("Inside group", "群組內"),
        ("Search inside a tab group", "搜尋群組內分頁"),
        ("Group to search", "要搜尋嘅群組"),
        ("Search tabs inside selected group", "搜尋所選群組內分頁"),
        ("Use regex for group tab search", "群組內分頁搜尋使用正則表達式"),
        ("Open regex builder for group tab search", "開啟群組內分頁搜尋嘅正則表達式建構器"),
        ("Group tab search results", "群組內分頁搜尋結果"),
        ("Search tab group names", "搜尋分頁群組名稱"),
        ("Use regex for group name search", "群組名稱搜尋使用正則表達式"),
        ("Open regex builder for group name search", "開啟群組名稱搜尋嘅正則表達式建構器"),
        ("Group name search results", "群組名稱搜尋結果"),
        ("Every tab", "全部"),
        ("Search every application tab", "搜尋所有應用程式分頁"),
        ("Use regex for master tab search", "全部分頁搜尋使用正則表達式"),
        ("Open regex builder for master tab search", "開啟全部分頁搜尋嘅正則表達式建構器"),
        ("Master tab search results", "全部分頁搜尋結果"),
        ("Bulk close", "批量關閉"),
        ("Close tabs by label", "按標籤關閉分頁"),
        ("Matches use visible tab labels. Pinned tabs are excluded unless you explicitly include them; no tab closes before the preview is confirmed.",
            "配對使用畫面可見嘅分頁標籤。除非你明確包括，否則會排除釘選分頁；確認預覽之前唔會關閉任何分頁。"),
        ("Text used to choose tabs to close", "用嚟揀選要關閉分頁嘅文字"),
        ("Use regex for bulk tab close", "批量關閉分頁使用正則表達式"),
        ("Open regex builder for bulk tab close", "開啟批量關閉分頁嘅正則表達式建構器"),
        ("Close tabs containing text", "關閉包含文字嘅分頁"),
        ("Close tabs not containing text", "關閉唔包含文字嘅分頁"),
        ("Bulk close matching mode", "批量關閉配對模式"),
        ("Include pinned tabs", "包括釘選分頁"),
        ("Include pinned tabs in bulk close", "批量關閉包括釘選分頁"),
        ("Refresh preview", "更新預覽"),
        ("Close previewed tabs", "關閉預覽分頁"),
        ("Create, rename, colour, reorder and collapse groups, then assign the selected tab.",
            "建立、重新命名、上色、排序同收合群組，再分配目前分頁。"),
        ("Close tab group editor", "關閉分頁群組編輯器"),
        ("Existing group", "現有群組"),
        ("Group to edit", "要編輯嘅群組"),
        ("Group name", "群組名稱"),
        ("Tab group name", "分頁群組名稱"),
        ("Color (#RRGGBB or #RRGGBBAA)", "顏色（#RRGGBB 或 #RRGGBBAA）"),
        ("Tab group color", "分頁群組顏色"),
        ("Create", "建立"),
        ("Save", "儲存"),
        ("Move group left", "將群組向左移"),
        ("Move group right", "將群組向右移"),
        ("Collapse / expand", "收合／展開"),
        ("Delete", "刪除"),
        ("Assign selected tab", "分配目前分頁"),
        ("Group for selected tab", "目前分頁所屬群組"),
        ("Close all tabs list", "關閉全部分頁清單"),
        ("All open, closed and overflowed tabs", "所有開啟、已關閉同超出範圍嘅分頁"),
    };

    public static string Localize(string value, string? languageMode)
    {
        if (string.IsNullOrEmpty(value)) return value;
        foreach (var pair in Entries)
        {
            if (!Matches(value, pair)) continue;
            return languageMode switch
            {
                "Cantonese" => pair.Cantonese,
                "Bilingual" => pair.English + " · " + pair.Cantonese,
                _ => pair.English,
            };
        }
        return value;
    }

    public static void Apply(DependencyObject? root, string? languageMode)
    {
        if (root is null) return;
        var visited = new HashSet<DependencyObject>(ReferenceEqualityComparer.Instance);
        Visit(root, languageMode, visited);
    }

    private static bool Matches(string value, (string English, string Cantonese) pair) =>
        value == pair.English || value == pair.Cantonese ||
        value == pair.English + " · " + pair.Cantonese ||
        value == pair.English + " / " + pair.Cantonese;

    private static void Visit(
        DependencyObject node,
        string? languageMode,
        ISet<DependencyObject> visited)
    {
        if (!visited.Add(node)) return;
        if (node is TextBlock text) text.Text = Localize(text.Text, languageMode);
        if (node is HeaderedContentControl headered && headered.Header is string header)
            headered.Header = Localize(header, languageMode);
        if (node is ContentControl content && content.Content is string value)
            content.Content = Localize(value, languageMode);
        if (node is FrameworkElement element && element.ToolTip is string toolTip)
            element.ToolTip = Localize(toolTip, languageMode);

        var automationName = AutomationProperties.GetName(node);
        if (!string.IsNullOrWhiteSpace(automationName))
            AutomationProperties.SetName(node, Localize(automationName, languageMode));

        if (node is Popup { Child: { } popupChild }) Visit(popupChild, languageMode, visited);
        foreach (var child in LogicalTreeHelper.GetChildren(node))
            if (child is DependencyObject dependency) Visit(dependency, languageMode, visited);
    }
}
