using System;
using System.Collections.Generic;

namespace WorldDownloaderManager;

/// <summary>Localized factual app-event copy. Humour changes voice only; the action and remedy stay explicit.</summary>
public static class AppCopy
{
    private static readonly IReadOnlyDictionary<string, (string English, string Cantonese)> Copy =
        new Dictionary<string, (string, string)>(StringComparer.Ordinal)
        {
            ["dockerMissing"] = (
                "Docker Desktop is not running. Start it, then retry.",
                "Docker Desktop 未運行。請先開啟，再重試。"),
            ["stopped"] = (
                "The downloader is stopped. Select Start to launch it.",
                "下載器已停止。按「開始」即可啟動。"),
            ["settingsSaved"] = (
                "Settings saved.",
                "設定已儲存。"),
            ["regexNoMatch"] = (
                "No matches were found.",
                "搵唔到符合項目。"),
            ["dimSumSurprise"] = (
                "A tiny dim-sum hello appeared. It will leave on its own.",
                "一粒點心嚟打個招呼，等陣會自己走。"),
        };

    public static string Get(string key, string languageMode, int englishFunny, int cantoneseFunny)
    {
        var pair = Copy.TryGetValue(key, out var value)
            ? value
            : (English: key, Cantonese: key);
        return Format(pair.English, pair.Cantonese, languageMode, englishFunny, cantoneseFunny);
    }

    public static string Format(
        string english,
        string cantonese,
        string languageMode,
        int englishFunny,
        int cantoneseFunny)
    {
        var styledEnglish = StyleEnglish(english, englishFunny);
        var styledCantonese = StyleCantonese(cantonese, cantoneseFunny);
        return languageMode switch
        {
            "Cantonese" => styledCantonese,
            "Bilingual" => styledEnglish + Environment.NewLine + styledCantonese,
            _ => styledEnglish,
        };
    }

    private static string StyleEnglish(string text, int level) => Math.Clamp(level, 1, 5) switch
    {
        1 => text,
        2 => text + " All set when you are.",
        3 => text + " No enchanted pickaxe required.",
        4 => text + " The tiny server goblin has filed the paperwork.",
        _ => text + " The tiny server goblin has filed the paperwork and returned the ceremonial wrench. 🔧",
    };

    private static string StyleCantonese(string text, int level) => Math.Clamp(level, 1, 5) switch
    {
        1 => text,
        2 => text + " 你準備好就得。",
        3 => text + " 唔使攞附魔鎬。",
        4 => text + " 小小伺服器精靈已經交齊表格。",
        _ => text + " 小小伺服器精靈交齊表格，仲捧埋吉祥扳手返嚟。🔧",
    };
}
