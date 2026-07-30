using System;
using System.Globalization;
using System.Linq;
using WorldDownloaderManager;
using Xunit;

namespace WorldDownloaderManager.Tests;

public sealed class RegexBuilderSafetyTests
{
    [Fact]
    public void CharacterClassEscapesDotNetClassMetacharactersAndKeepsSlashLiteral()
    {
        const string characters = "^[]-/\\";

        var pattern = RegexBuilderService.CharacterClass(characters);
        var result = RegexBuilderService.Evaluate(pattern, "", characters);

        Assert.Equal(@"[\^\[\]\-/\\]", pattern);
        Assert.True(result.IsValid, result.Error);
        Assert.Equal(characters.Select(character => character.ToString()),
            result.Matches.Select(match => match.Value));
    }

    [Fact]
    public void NegatedCharacterClassKeepsCaretAndSlashSemanticsDistinct()
    {
        var pattern = RegexBuilderService.CharacterClass("^/", negate: true);
        var result = RegexBuilderService.Evaluate(pattern, "", "^/a");

        Assert.Equal(@"[^\^/]", pattern);
        Assert.True(result.IsValid, result.Error);
        Assert.Equal("a", Assert.Single(result.Matches).Value);
    }

    [Fact]
    public void EmptyCharacterClassesHaveValidEmptySetAndComplementSemantics()
    {
        var emptySetPattern = RegexBuilderService.CharacterClass("");
        var complementPattern = RegexBuilderService.CharacterClass("", negate: true);
        var emptySet = RegexBuilderService.Evaluate(emptySetPattern, "", "a\n");
        var complement = RegexBuilderService.Evaluate(complementPattern, "", "a\n");

        Assert.Equal("(?!)", emptySetPattern);
        Assert.True(emptySet.IsValid, emptySet.Error);
        Assert.Empty(emptySet.Matches);
        Assert.Equal(@"[\s\S]", complementPattern);
        Assert.True(complement.IsValid, complement.Error);
        Assert.Equal(new[] { "a", "\n" }, complement.Matches.Select(match => match.Value));
    }

    [Fact]
    public void UnmatchedOptionalGroupsAreOmittedButSuccessfulEmptyGroupsRemain()
    {
        var result = RegexBuilderService.Evaluate(@"(?<optional>a)?(?<empty>)b", "", "b");

        Assert.True(result.IsValid, result.Error);
        var match = Assert.Single(result.Matches);
        Assert.DoesNotContain(match.Captures, capture => capture.Name == "optional");
        var empty = Assert.Single(match.Captures, capture => capture.Name == "empty");
        Assert.Equal(0, empty.Length);
        Assert.Equal(0, empty.Value.Length);
    }

    [Fact]
    public void SparseExplicitNumberGroupsAreReturnedByTheirActualGroupNumber()
    {
        var result = RegexBuilderService.Evaluate(@"(?<10>a)(?<word>b)?", "", "a");

        Assert.True(result.IsValid, result.Error);
        var captures = Assert.Single(result.Matches).Captures;
        var numbered = Assert.Single(captures, capture => capture.Group == 10);
        Assert.Equal("10", numbered.Name);
        Assert.Equal("a", numbered.Value);
        Assert.DoesNotContain(captures, capture => capture.Name == "word");
    }

    [Fact]
    public void PatternAndSampleLimitsAcceptExactBoundariesAndRejectOnePastThem()
    {
        var boundaryPattern = new string('a', RegexBuilderService.MaxPatternLength);
        var boundaryPatternResult = RegexBuilderService.Evaluate(
            boundaryPattern, "", new string('a', RegexBuilderService.MaxPatternLength));
        var oversizedPatternResult = RegexBuilderService.Evaluate(
            boundaryPattern + "a", "", "a");

        var boundarySample = new string('a', RegexBuilderService.MaxSampleLength);
        var boundarySampleResult = RegexBuilderService.Evaluate(
            @"\A.{100000}\z", "s", boundarySample);
        var oversizedSampleResult = RegexBuilderService.Evaluate(
            "a", "", boundarySample + "a");

        Assert.True(boundaryPatternResult.IsValid, boundaryPatternResult.Error);
        Assert.Equal(RegexBuilderService.MaxPatternLength,
            Assert.Single(boundaryPatternResult.Matches).Length);
        Assert.False(oversizedPatternResult.IsValid);
        Assert.Contains(RegexBuilderService.MaxPatternLength.ToString(CultureInfo.InvariantCulture),
            oversizedPatternResult.Error!);

        Assert.True(boundarySampleResult.IsValid, boundarySampleResult.Error);
        Assert.False(boundarySampleResult.IsTruncated);
        Assert.Equal(RegexBuilderService.MaxSampleLength,
            Assert.Single(boundarySampleResult.Matches).Length);
        Assert.False(oversizedSampleResult.IsValid);
        Assert.Contains(RegexBuilderService.MaxSampleLength.ToString(CultureInfo.InvariantCulture),
            oversizedSampleResult.Error!);
    }

    [Fact]
    public void ZeroWidthMatchLimitDistinguishesExactBoundaryFromTruncation()
    {
        var exact = RegexBuilderService.Evaluate(
            @"(?=a)", "", new string('a', RegexBuilderService.MaxMatches));
        var onePast = RegexBuilderService.Evaluate(
            @"(?=a)", "", new string('a', RegexBuilderService.MaxMatches + 1));

        Assert.True(exact.IsValid, exact.Error);
        Assert.Equal(RegexBuilderService.MaxMatches, exact.Matches.Count);
        Assert.False(exact.IsTruncated);
        Assert.All(exact.Matches, match => Assert.Equal(0, match.Length));

        Assert.True(onePast.IsValid, onePast.Error);
        Assert.Equal(RegexBuilderService.MaxMatches, onePast.Matches.Count);
        Assert.True(onePast.IsTruncated);
        Assert.All(onePast.Matches, match => Assert.Equal(0, match.Length));
    }

    [Fact]
    public void CaptureGroupBudgetHasAnExactNonTruncatedBoundary()
    {
        const int groupsPerMatch = 250;
        var pattern = new string('(', groupsPerMatch) + "a" + new string(')', groupsPerMatch);
        var exactMatchCount = RegexBuilderService.MaxCaptureGroups / groupsPerMatch;

        var exact = RegexBuilderService.Evaluate(pattern, "", new string('a', exactMatchCount));
        var onePast = RegexBuilderService.Evaluate(pattern, "", new string('a', exactMatchCount + 1));

        Assert.True(exact.IsValid, exact.Error);
        Assert.Equal(RegexBuilderService.MaxCaptureGroups, CountCaptureGroups(exact));
        Assert.False(exact.IsTruncated);

        Assert.True(onePast.IsValid, onePast.Error);
        Assert.Equal(RegexBuilderService.MaxCaptureGroups, CountCaptureGroups(onePast));
        Assert.True(onePast.IsTruncated);
        Assert.True(onePast.EstimatedOutputCharacters <= RegexBuilderService.MaxResultOutputCharacters);
    }

    [Fact]
    public void LargeNestedCapturesStopAtTheOutputBudget()
    {
        const int nestedGroups = 200;
        var pattern = new string('(', nestedGroups) + "a+" + new string(')', nestedGroups);
        var result = RegexBuilderService.Evaluate(pattern, "", new string('a', 2_000));

        Assert.True(result.IsValid, result.Error);
        Assert.True(result.IsTruncated);
        Assert.True(CountCaptureGroups(result) < nestedGroups);
        Assert.InRange(result.EstimatedOutputCharacters, 1,
            RegexBuilderService.MaxResultOutputCharacters);
    }

    [Fact]
    public void OverlappingLookaheadCapturesCannotMultiplyMaterializedOutput()
    {
        var result = RegexBuilderService.Evaluate(
            @"(?=(?<outer>(?<inner>a*)))", "", new string('a', RegexBuilderService.MaxSampleLength));

        Assert.True(result.IsValid, result.Error);
        Assert.True(result.IsTruncated);
        var match = Assert.Single(result.Matches);
        Assert.Contains(match.Captures, capture => capture.Name == "outer");
        Assert.DoesNotContain(match.Captures, capture => capture.Name == "inner");
        Assert.True(result.EstimatedOutputCharacters <= RegexBuilderService.MaxResultOutputCharacters);
    }

    [Fact]
    public void OutputBudgetAcceptsItsExactBoundaryAndTruncatesOneCharacterPastIt()
    {
        // For a 65,505-character match and the two-character group name "xx", the
        // service's conservative match + capture estimates total exactly 128 KiB.
        const int exactValueLength = 65_505;
        var exact = RegexBuilderService.Evaluate(
            @"\A(?<xx>.*)\z", "", new string('a', exactValueLength));
        var onePast = RegexBuilderService.Evaluate(
            @"\A(?<xx>.*)\z", "", new string('a', exactValueLength + 1));

        Assert.True(exact.IsValid, exact.Error);
        Assert.False(exact.IsTruncated);
        Assert.Equal(RegexBuilderService.MaxResultOutputCharacters,
            exact.EstimatedOutputCharacters);
        Assert.Equal(1, CountCaptureGroups(exact));

        Assert.True(onePast.IsValid, onePast.Error);
        Assert.True(onePast.IsTruncated);
        Assert.True(onePast.EstimatedOutputCharacters < RegexBuilderService.MaxResultOutputCharacters);
        Assert.Equal(0, CountCaptureGroups(onePast));
    }

    [Fact]
    public void UnicodeAndMultilineMatchingRemainSupported()
    {
        var result = RegexBuilderService.Evaluate(
            @"^(?<word>café)$", "im", "CAFÉ\nnot-this\ncafé");

        Assert.True(result.IsValid, result.Error);
        Assert.Equal(new[] { "CAFÉ", "café" }, result.Matches.Select(match => match.Value));
        Assert.All(result.Matches, match =>
            Assert.Contains(match.Captures, capture => capture.Name == "word"));
    }

    [Fact]
    public void AdversarialBacktrackingStillHonorsTheTimeout()
    {
        var result = RegexBuilderService.Evaluate(
            "(a+)+$", "", new string('a', 12_000) + "!");

        Assert.False(result.IsValid);
        Assert.Contains("150 ms safety limit", result.Error!);
        Assert.Empty(result.Matches);
    }

    [Fact]
    public void EvaluationWideDeadlineStopsAggregateWorkBeyondThePerMatchTimeout()
    {
        var result = RegexBuilderService.EvaluateWithTotalTimeoutForTesting(
            @"(?=a)", "", new string('a', RegexBuilderService.MaxSampleLength), TimeSpan.Zero);

        Assert.False(result.IsValid);
        Assert.Contains($"{RegexBuilderService.EvaluationTimeoutMilliseconds} ms safety limit", result.Error!);
        Assert.Empty(result.Matches);
    }

    [Fact]
    public void SearchSetUsesOneAggregateDeadlineAndReturnsNoPartialMatches()
    {
        var result = RegexBuilderService.EvaluateSearchSet(
            "a", "i", new[] { "a", "b", "a" }, TimeSpan.Zero);

        Assert.False(result.IsValid);
        Assert.Contains($"{RegexBuilderService.EvaluationTimeoutMilliseconds} ms safety limit", result.Error!);
        Assert.Empty(result.Matches);
    }

    private static int CountCaptureGroups(RegexEvaluation result) =>
        result.Matches.Sum(match => match.Captures.Count(capture => capture.Group > 0));
}
