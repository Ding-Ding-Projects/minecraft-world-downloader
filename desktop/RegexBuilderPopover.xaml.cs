using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace WorldDownloaderManager;

public sealed class RegexApplyRequestedEventArgs : EventArgs
{
    public RegexApplyRequestedEventArgs(string pattern, string flags)
    {
        Pattern = pattern;
        Flags = flags;
    }

    public string Pattern { get; }
    public string Flags { get; }
}

/// <summary>A reusable full regex workbench intended to live in a Popup anchored to one search box.</summary>
public partial class RegexBuilderPopover : UserControl
{
    private bool _loading;
    private string _languageMode = "English";

    public RegexBuilderPopover()
    {
        InitializeComponent();
        Evaluate();
    }

    public event EventHandler<RegexApplyRequestedEventArgs>? ApplyRequested;
    public event EventHandler? DismissRequested;

    public string Pattern => PatternBox.Text;
    public string Flags => FlagsBox.Text;
    public string Sample => SampleBox.Text;
    public bool IsPatternValid => RegexBuilderService.Evaluate(Pattern, Flags, Sample).IsValid;

    public void Configure(string titleEnglish, string titleCantonese, string? languageMode)
    {
        _languageMode = languageMode is "Cantonese" or "Bilingual" ? languageMode : "English";
        TitleText.Text = Localize(titleEnglish, titleCantonese);
        DescriptionText.Text = Localize(
            "Local .NET regular expression evaluation. Pattern 2,048 characters; sample 100,000 characters; 150 ms deadline.",
            "只會喺本機用 .NET 正則表達式運算。Pattern 上限 2,048 字；sample 上限 100,000 字；總時限 150 ms。");
        PatternLabel.Text = Localize("Raw pattern", "原始 pattern");
        FlagsLabel.Text = Localize("Flags", "旗標");
        SampleLabel.Text = Localize("Sample text", "測試文字");
        LiteralButton.Content = Localize("Escape literal", "轉義純文字");
        ClassButton.Content = Localize("[class]", "[字元類別]");
        GroupButton.Content = Localize("(group)", "(群組)");
        AlternateButton.Content = Localize("| alternate", "| 或者");
        AnchorButton.Content = Localize("^ anchor $", "^ 錨點 $");
        QuantifierButton.Content = Localize("One or more", "一次或以上");
        CopyButton.Content = Localize("Copy pattern", "複製 pattern");
        ExportButton.Content = Localize("Export pattern…", "匯出 pattern…");
        ApplyButton.Content = Localize("Apply to search", "套用到搜尋");
        System.Windows.Automation.AutomationProperties.SetName(PatternBox,
            Localize("Raw regex pattern", "原始正則表達式 pattern"));
        System.Windows.Automation.AutomationProperties.SetName(FlagsBox,
            Localize("Regex flags i m s n", "正則表達式旗標 i m s n"));
        System.Windows.Automation.AutomationProperties.SetName(SampleBox,
            Localize("Regex sample text", "正則表達式測試文字"));
        Evaluate();
    }

    public void LoadState(string? pattern, string? flags, string? sample)
    {
        _loading = true;
        PatternBox.Text = pattern ?? "";
        FlagsBox.Text = flags ?? "i";
        SampleBox.Text = sample ?? "";
        _loading = false;
        Evaluate();
    }

    public void FocusPattern()
    {
        PatternBox.Focus();
        PatternBox.SelectAll();
    }

    private string Localize(string english, string cantonese) => _languageMode switch
    {
        "Cantonese" => cantonese,
        "Bilingual" => english + " · " + cantonese,
        _ => english,
    };

    private void Input_Changed(object sender, TextChangedEventArgs e)
    {
        if (!_loading) Evaluate();
    }

    private void Evaluate()
    {
        if (PatternBox is null || FlagsBox is null || SampleBox is null ||
            FeedbackText is null || ResultsBox is null) return;
        var result = RegexBuilderService.Evaluate(Pattern, Flags, Sample);
        if (!result.IsValid)
        {
            FeedbackText.Text = Localize("Regex error: ", "正則表達式錯誤：") + result.Error;
            ResultsBox.Text = "";
            ApplyButton.IsEnabled = false;
            return;
        }

        ApplyButton.IsEnabled = true;
        FeedbackText.Text = result.Matches.Count == 0
            ? Localize("Valid .NET pattern; no preview matches.", "有效 .NET pattern；預覽冇 match。")
            : Localize(
                $"Valid .NET pattern; {result.Matches.Count} preview match(es).",
                $"有效 .NET pattern；預覽有 {result.Matches.Count} 個 match。") +
              (result.IsTruncated ? Localize(" Results were safely truncated.", " 結果已按安全上限截短。") : "");

        var output = new StringBuilder();
        foreach (var match in result.Matches)
        {
            output.AppendLine($"[{match.Index}..{match.Index + match.Length}] {match.Value}");
            foreach (var capture in match.Captures.Where(capture => capture.Group > 0))
                output.AppendLine($"  group {capture.Name}: [{capture.Index}..{capture.Index + capture.Length}] {capture.Value}");
        }
        ResultsBox.Text = output.ToString();
    }

    private void Literal_Click(object sender, RoutedEventArgs e) =>
        PatternBox.Text = RegexBuilderService.Literal(PatternBox.Text);

    private void Class_Click(object sender, RoutedEventArgs e) =>
        PatternBox.Text = RegexBuilderService.CharacterClass(PatternBox.Text);

    private void Group_Click(object sender, RoutedEventArgs e) =>
        PatternBox.Text = RegexBuilderService.Group(PatternBox.Text);

    private void Alternate_Click(object sender, RoutedEventArgs e) => PatternBox.Text += "|";

    private void Anchor_Click(object sender, RoutedEventArgs e) =>
        PatternBox.Text = RegexBuilderService.Anchored(PatternBox.Text);

    private void Quantifier_Click(object sender, RoutedEventArgs e) =>
        PatternBox.Text = RegexBuilderService.Quantify(PatternBox.Text, 1);

    private void Copy_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            Clipboard.SetText(Pattern);
            FeedbackText.Text = Localize("Pattern copied to the clipboard.", "Pattern 已複製到剪貼簿。");
        }
        catch (Exception ex)
        {
            FeedbackText.Text = Localize("Pattern was not copied: ", "Pattern 未能複製：") + ex.Message;
        }
    }

    private void Export_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new Microsoft.Win32.SaveFileDialog
        {
            Filter = "Markdown (*.md)|*.md|Text (*.txt)|*.txt",
            FileName = "world-downloader-regex.md",
        };
        if (dialog.ShowDialog() != true) return;
        try
        {
            File.WriteAllText(dialog.FileName,
                $"# .NET regular expression\n\nFlags: `{Flags}`\n\n```regex\n{Pattern}\n```\n");
            FeedbackText.Text = Localize("Pattern exported to ", "Pattern 已匯出到 ") + dialog.FileName;
        }
        catch (Exception ex)
        {
            FeedbackText.Text = Localize("Pattern was not exported: ", "Pattern 未能匯出：") + ex.Message;
        }
    }

    private void Apply_Click(object sender, RoutedEventArgs e)
    {
        var result = RegexBuilderService.Evaluate(Pattern, Flags, Sample);
        if (!result.IsValid)
        {
            Evaluate();
            return;
        }
        ApplyRequested?.Invoke(this, new RegexApplyRequestedEventArgs(Pattern, Flags));
    }

    private void Builder_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Escape) return;
        DismissRequested?.Invoke(this, EventArgs.Empty);
        e.Handled = true;
    }
}
