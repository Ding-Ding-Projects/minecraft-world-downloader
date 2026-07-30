using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace WorldDownloaderManager;

public sealed record RegexCapture(int Group, string Name, string Value, int Index, int Length);
public sealed record RegexMatchResult(int Index, int Length, string Value, IReadOnlyList<RegexCapture> Captures);
public sealed record RegexEvaluation(
    bool IsValid,
    string? Error,
    IReadOnlyList<RegexMatchResult> Matches,
    bool IsTruncated = false,
    int EstimatedOutputCharacters = 0);
public sealed record RegexSearchSetEvaluation(
    bool IsValid,
    string? Error,
    IReadOnlyList<bool> Matches);

/// <summary>Bounded .NET regular-expression evaluation shared by every desktop search surface.</summary>
public static class RegexBuilderService
{
    public const int MaxPatternLength = 2_048;
    public const int MaxSampleLength = 100_000;
    public const int MaxMatches = 500;
    public const int MaxCaptureGroups = 2_000;
    public const int MaxResultOutputCharacters = 128 * 1_024;
    public const int EvaluationTimeoutMilliseconds = 150;
    private const int SearchOperationTimeoutMilliseconds = 25;
    private static readonly TimeSpan MatchTimeout = TimeSpan.FromMilliseconds(EvaluationTimeoutMilliseconds);

    public static RegexEvaluation Evaluate(string pattern, string flags, string sample) =>
        EvaluateCore(pattern, flags, sample, MatchTimeout);

    internal static RegexEvaluation EvaluateWithTotalTimeoutForTesting(
        string pattern, string flags, string sample, TimeSpan totalTimeout)
    {
        if (totalTimeout < TimeSpan.Zero || totalTimeout > MatchTimeout)
            throw new ArgumentOutOfRangeException(nameof(totalTimeout));
        return EvaluateCore(pattern, flags, sample, totalTimeout);
    }

    /// <summary>
    /// Compiles once and searches independent strings under one aggregate deadline. A shorter
    /// per-string timeout bounds deadline overshoot while preserving the workbench dialect.
    /// </summary>
    internal static RegexSearchSetEvaluation EvaluateSearchSet(
        string pattern, string flags, IReadOnlyList<string> samples, TimeSpan totalTimeout)
    {
        ArgumentNullException.ThrowIfNull(samples);
        if (totalTimeout < TimeSpan.Zero || totalTimeout > MatchTimeout)
            throw new ArgumentOutOfRangeException(nameof(totalTimeout));
        if (pattern.Length > MaxPatternLength)
            return InvalidSearchSet($"Pattern is limited to {MaxPatternLength} characters.");
        if (samples.Any(sample => sample is null || sample.Length > MaxSampleLength))
            return InvalidSearchSet($"Each searchable item is limited to {MaxSampleLength} characters.");
        if (totalTimeout == TimeSpan.Zero) return TimedOutSearchSet();

        try
        {
            var timer = Stopwatch.StartNew();
            var operationTimeout = TimeSpan.FromMilliseconds(Math.Min(
                SearchOperationTimeoutMilliseconds,
                Math.Max(1d, totalTimeout.TotalMilliseconds)));
            var regex = new Regex(pattern, ParseOptions(flags), operationTimeout);
            if (timer.Elapsed >= totalTimeout) return TimedOutSearchSet();

            var matches = new bool[samples.Count];
            for (var index = 0; index < samples.Count; index++)
            {
                if (timer.Elapsed >= totalTimeout) return TimedOutSearchSet();
                matches[index] = regex.IsMatch(samples[index]);
            }
            if (timer.Elapsed >= totalTimeout) return TimedOutSearchSet();
            return new RegexSearchSetEvaluation(true, null, matches);
        }
        catch (ArgumentException ex)
        {
            return InvalidSearchSet(ex.Message);
        }
        catch (RegexMatchTimeoutException)
        {
            return TimedOutSearchSet();
        }
    }

    private static RegexEvaluation EvaluateCore(
        string pattern, string flags, string sample, TimeSpan totalTimeout)
    {
        if (pattern.Length > MaxPatternLength)
            return Invalid($"Pattern is limited to {MaxPatternLength} characters.");
        if (sample.Length > MaxSampleLength)
            return Invalid($"Sample text is limited to {MaxSampleLength} characters.");

        try
        {
            var evaluationTimer = Stopwatch.StartNew();
            var regex = new Regex(pattern, ParseOptions(flags), MatchTimeout);
            if (evaluationTimer.Elapsed >= totalTimeout) return TimedOut();

            var groupNumbers = regex.GetGroupNumbers();
            var matches = new List<RegexMatchResult>(Math.Min(MaxMatches, 64));
            var captureGroupCount = 0;
            var estimatedOutputCharacters = 0;
            var truncated = false;

            foreach (Match match in regex.Matches(sample))
            {
                if (evaluationTimer.Elapsed >= totalTimeout) return TimedOut();
                if (matches.Count == MaxMatches)
                {
                    truncated = true;
                    break;
                }

                var matchOutputCharacters = EstimateMatchOutputCharacters(match.Index, match.Length);
                if (estimatedOutputCharacters + matchOutputCharacters > MaxResultOutputCharacters)
                {
                    truncated = true;
                    break;
                }
                estimatedOutputCharacters += matchOutputCharacters;

                var matchValue = match.Value;
                var captures = new List<RegexCapture>(Math.Min(groupNumbers.Length, 32))
                {
                    // Preserve the existing group-zero record for callers that use it as the whole match.
                    new(0, regex.GroupNameFromNumber(0), matchValue, match.Index, match.Length),
                };

                var stopAfterThisMatch = false;
                foreach (var groupNumber in groupNumbers)
                {
                    if (groupNumber == 0) continue;
                    if (evaluationTimer.Elapsed >= totalTimeout) return TimedOut();
                    var group = match.Groups[groupNumber];
                    if (!group.Success) continue;

                    if (captureGroupCount == MaxCaptureGroups)
                    {
                        truncated = true;
                        stopAfterThisMatch = true;
                        break;
                    }

                    var name = regex.GroupNameFromNumber(groupNumber);
                    var captureOutputCharacters = EstimateCaptureOutputCharacters(
                        name, group.Index, group.Length);
                    if (estimatedOutputCharacters + captureOutputCharacters > MaxResultOutputCharacters)
                    {
                        truncated = true;
                        stopAfterThisMatch = true;
                        break;
                    }

                    estimatedOutputCharacters += captureOutputCharacters;
                    captureGroupCount++;
                    captures.Add(new RegexCapture(groupNumber, name, group.Value, group.Index, group.Length));
                }

                matches.Add(new RegexMatchResult(match.Index, match.Length, matchValue, captures));
                if (stopAfterThisMatch) break;
            }

            if (evaluationTimer.Elapsed >= totalTimeout) return TimedOut();
            return new RegexEvaluation(true, null, matches, truncated, estimatedOutputCharacters);
        }
        catch (ArgumentException ex)
        {
            return Invalid(ex.Message);
        }
        catch (RegexMatchTimeoutException)
        {
            return TimedOut();
        }
    }

    public static string Literal(string text) => Regex.Escape(text);
    public static string CharacterClass(string characters, bool negate = false)
    {
        ArgumentNullException.ThrowIfNull(characters);
        if (characters.Length == 0) return negate ? @"[\s\S]" : "(?!)";
        var escaped = new StringBuilder(characters.Length * 2);
        foreach (var character in characters)
        {
            // Forward slash is not a delimiter in .NET regex and stays literal. These five
            // characters are escaped wherever they occur so their position cannot change meaning.
            if (character is '\\' or '^' or '[' or ']' or '-') escaped.Append('\\');
            escaped.Append(character);
        }
        return $"[{(negate ? "^" : "")}{escaped}]";
    }
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

    // Conservative upper bounds for the exact text currently rendered by the desktop result views.
    // The padding covers brackets, separators, decimal indices and the platform newline.
    private static int EstimateMatchOutputCharacters(int index, int length) =>
        length + DecimalDigitCount(index) + DecimalDigitCount(index + length) + 16;

    private static int EstimateCaptureOutputCharacters(string name, int index, int length) =>
        length + name.Length + DecimalDigitCount(index) + DecimalDigitCount(index + length) + 32;

    private static int DecimalDigitCount(int value)
    {
        if (value == 0) return 1;
        var count = 0;
        while (value > 0)
        {
            value /= 10;
            count++;
        }
        return count;
    }

    private static RegexEvaluation Invalid(string error) =>
        new(false, error, Array.Empty<RegexMatchResult>());

    private static RegexEvaluation TimedOut() =>
        Invalid($"Pattern evaluation exceeded the {EvaluationTimeoutMilliseconds} ms safety limit.");

    private static RegexSearchSetEvaluation InvalidSearchSet(string error) =>
        new(false, error, Array.Empty<bool>());

    private static RegexSearchSetEvaluation TimedOutSearchSet() =>
        InvalidSearchSet($"Pattern evaluation exceeded the {EvaluationTimeoutMilliseconds} ms safety limit.");
}
