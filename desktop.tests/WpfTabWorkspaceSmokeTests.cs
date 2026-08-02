using System;
using System.Runtime.ExceptionServices;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using WorldDownloaderManager;
using Xunit;

namespace WorldDownloaderManager.Tests;

public sealed class WpfTabWorkspaceSmokeTests
{
    [Fact]
    public void MainWindowConstructsBrowserTabWorkspaceOnStaThread()
    {
        RunOnStaThread(() =>
        {
            var window = new MainWindow();

            Assert.Equal(AppTabCatalog.Definitions.Count, window.MainTabs.Items.Count);
            Assert.IsType<TabItem>(window.MainTabs.SelectedItem);
            Assert.Equal(AppTabCatalog.Definitions.Count, window.TabOverflowList.Items.Count);
            Assert.NotNull(window.DownloaderTab.ContextMenu);
            Assert.IsAssignableFrom<FrameworkElement>(window.DownloaderTab.Header);
            Assert.False(window.TabSearchPopup.IsOpen);
            Assert.False(window.TabGroupPopup.IsOpen);
            Assert.Equal(RegexBuilderService.MaxPatternLength, window.CurrentTabSearchBox.MaxLength);
            Assert.Equal(RegexBuilderService.MaxPatternLength, window.TabCloseSearchBox.MaxLength);
        });
    }

    [Fact]
    public void GroupHex8UsesRrggbbaaRatherThanWpfAarrggbbOrdering()
    {
        RunOnStaThread(() =>
        {
            var brush = Assert.IsType<System.Windows.Media.SolidColorBrush>(
                MainWindow.TryBrush("#12345678"));
            Assert.Equal(0x12, brush.Color.R);
            Assert.Equal(0x34, brush.Color.G);
            Assert.Equal(0x56, brush.Color.B);
            Assert.Equal(0x78, brush.Color.A);
        });
    }

    [Fact]
    public void ReusableAnchoredRegexBuilderConstructsAndEvaluatesOnStaThread()
    {
        RunOnStaThread(() =>
        {
            var builder = new RegexBuilderPopover();
            builder.Configure("Tab regex", "分頁正則表達式", "Bilingual");
            builder.LoadState("(?<tab>設定)", "i", "Settings · 設定");

            Assert.True(builder.IsPatternValid);
            Assert.Equal("(?<tab>設定)", builder.Pattern);
            Assert.Equal("i", builder.Flags);
            Assert.Contains("設定", builder.Sample);
        });
    }

    private static void RunOnStaThread(Action action)
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try { action(); }
            catch (Exception ex) { failure = ex; }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        Assert.True(thread.Join(TimeSpan.FromSeconds(20)), "The WPF smoke-test thread did not finish within 20 seconds.");
        if (failure is not null) ExceptionDispatchInfo.Capture(failure).Throw();
    }
}
