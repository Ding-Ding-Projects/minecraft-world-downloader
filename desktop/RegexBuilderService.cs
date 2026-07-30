using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace WorldDownloaderManager;

public sealed record RegexCapture(int Group, string Name, string Value, int Index, int Length);
public sealed record RegexMatchResult(int Index, int Length, string Value, IReadOnlyList<RegexCapture> Captures);
public sealed record RegexEvaluation(bool IsValid, string? Error, IReadOnlyList<RegexMatchResult> Matches);

/// <summary>Bounded .NET regular-expression evaluation shared by every desktop search surface.</summary>
public static class RegexBuilderService
{
    public const int MaxPatternLength = 2_048;
    public const int MaxSampleLength = 100_000;
    public const int MaxMatches = 500;
    private static readonly TimeSpan MatchTimeout = TimeSpan.FromMilliseconds(150);

    public static RegexEvaluation Evaluate(string pattern, string flags, string sample)
    {
        if (pattern.Length > MaxPatternLength)
            return Invalid($"Pattern is limited to {MaxPatternLength} characters.");
        if (sample.Length > MaxSampleLength)
            return Invalid($"Sample text is limited to {MaxSampleLength} characters.");

        try
        {
            var regex = new Regex(pattern, ParseOptions(flags), MatchTimeout);
            var names = regex.GetGroupNames();
            var matches = regex.Matches(sample).Cast<Match>().Take(MaxMatches).Select(match =>
            {
                var captures = match.Groups.Cast<Group>().Select((group, index) =>
                    new RegexCapture(index, names[index], group.Value, group.Index, group.Length)).ToArray();
                return new RegexMatchResult(match.Index, match.Length, match.Value, captures);
            }).ToArray();
            return new RegexEvaluation(true, null, matches);
        }
        catch (ArgumentException ex)
        {
            return Invalid(ex.Message);
        }
        catch (RegexMatchTimeoutException)
        {
            return Invalid("Pattern evaluation exceeded the 150 ms safety limit.");
        }
    }

    public static string Literal(string text) => Regex.Escape(text);
    public static string CharacterClass(string characters, bool negate = false) =>
        $"[{(negate ? "^" : "")}{characters.Replace("\\", "\\\\").Replace("]", "\\]").Replace("-", "\\-")}]";
    public static string Group(string pattern, bool capture = true) => $"({(capture ? "" : "?:")}{pattern})";
    public static string Alternation(params string[] patterns) => string.Join("|", patterns);
    public static string Quantify(string pattern, int minimum, int? maximum = null) =>
        $"(?:{pattern}){{{minimum},{(maximum?.ToString() ?? "")}}}";
    public static string Anchored(string pattern) => $"^{pattern}$";

    private static RegexOptions ParseOptions(string flags)
    {
        var options = RegexOptions.CultureInvariant;
        foreach (var flag in flags.Distinct())
        {
            options |= flag switch
            {
                'i' => RegexOptions.IgnoreCase,
                'm' => RegexOptions.Multiline,
                's' => RegexOptions.Singleline,
                'n' => RegexOptions.ExplicitCapture,
                _ => throw new ArgumentException($"Unsupported .NET regex flag '{flag}'. Use i, m, s or n."),
            };
        }
        return options;
    }

    private static RegexEvaluation Invalid(string error) => new(false, error, Array.Empty<RegexMatchResult>());
}
