import { changelog, commitUrl } from './data';
import { groupByCategory } from './filter';
import type { ChangelogFilter, FilterResult } from './filter';
import type { ChangeCategory, ChangelogRow } from './types';

/**
 * Turning what is on screen into something that can leave the window.
 *
 * Two properties are non-negotiable here.
 *
 * The file says what it is. Every export states the exact version range, the
 * filter that produced it, the language it was written in and the commit the
 * bundle was generated from — so a copy pasted into an issue three weeks later
 * still explains itself.
 *
 * The commit id survives as TEXT. A Markdown link carries the id in its own
 * label and a plain-text export writes the id out in full, so a changelog that
 * leaves this application is still traceable back to the repository even where
 * the link is not clickable.
 */

export interface FormatContext {
  /** Localized category name, so the file matches what the reader saw. */
  categoryLabel(category: ChangeCategory): string;
  /** Localized name of the unreleased section. */
  unreleasedLabel: string;
  /** `en`, `yue` or `both`, stated in the header. */
  languageMode: string;
  /** The product name, taken from the shipped identity rather than a rename. */
  productName: string;
  productVersion: string;
  /** A human description of the active filter, or an empty string. */
  filterDescription: string;
  /** When the export was produced. */
  exportedAt: string;
}

function coverage(result: FilterResult): { first: string | null; last: string | null } {
  if (result.releases.length === 0) return { first: null, last: null };
  const versions = result.releases.map((item) => item.release);
  return { first: versions[versions.length - 1].version, last: versions[0].version };
}

function headerLines(result: FilterResult, filter: ChangelogFilter, ctx: FormatContext): string[] {
  const { first, last } = coverage(result);
  const range =
    first === null || last === null
      ? 'no versions matched the filter'
      : first === last
        ? `version ${first}`
        : `versions ${last} down to ${first}`;

  const lines = [
    `Product: ${ctx.productName} ${ctx.productVersion}`,
    `Exported: ${ctx.exportedAt}`,
    `Covers: ${range} (${result.releases.length} versions, ${result.entryCount} changes)`,
    `Filter: ${ctx.filterDescription === '' ? 'none — the whole changelog' : ctx.filterDescription}`,
    `Language: ${ctx.languageMode}`,
    `Generated from commit ${changelog.headCommit} on ${changelog.generatedAt}`,
    `Regenerate with: ${changelog.command}`
  ];
  if (result.hiddenCount > 0) {
    lines.push(`Withheld by the filter: ${result.hiddenCount} changes inside the versions listed here`);
  }
  if (changelog.forge.commitUrlTemplate === null) {
    lines.push('Commit links: none — this repository has no recognised forge, so commit ids appear as text only');
  } else {
    lines.push(`Commit links: ${changelog.forge.commitUrlTemplate}`);
  }
  return lines;
}

function entryLine(summary: string, sha: string, url: string | null, markdown: boolean): string {
  if (markdown && url !== null) return `- ${summary} ([\`${sha}\`](${url}))`;
  if (markdown) return `- ${summary} (\`${sha}\`)`;
  return `  - ${summary} (${sha})`;
}

export function toMarkdown(result: FilterResult, filter: ChangelogFilter, ctx: FormatContext, grouped: boolean): string {
  const lines: string[] = [`# ${ctx.productName} changelog`, ''];
  for (const line of headerLines(result, filter, ctx)) lines.push(`> ${line}`);
  lines.push('');

  if (result.releases.length === 0) {
    lines.push('No version matched the filter that produced this file.');
    lines.push('');
    return lines.join('\n');
  }

  for (const item of result.releases) {
    const release = item.release;
    const title = release.released ? release.version : `${ctx.unreleasedLabel} (${release.version})`;
    lines.push(`## ${title} — ${release.date}`);
    lines.push('');
    lines.push(
      `Tagged at \`${release.commit}\`. ${release.entries.length} recorded changes from ${release.commitCount} commits.`
    );
    lines.push('');

    if (item.entries.length === 0) {
      lines.push(
        release.entries.length === 0
          ? 'No changes are recorded for this version: its tag points at the same commit as the version before it.'
          : 'Every change in this version was withheld by the filter.'
      );
      lines.push('');
      continue;
    }

    const sections = grouped
      ? groupByCategory(item.entries)
      : [{ category: null as ChangeCategory | null, entries: item.entries }];

    for (const section of sections) {
      if (section.category !== null) {
        lines.push(`### ${ctx.categoryLabel(section.category)}`);
        lines.push('');
      }
      for (const entry of section.entries) {
        const prefix = entry.breaking ? '**Breaking.** ' : '';
        const label = section.category === null ? `${ctx.categoryLabel(entry.category)}: ` : '';
        lines.push(entryLine(`${prefix}${label}${entry.summary}`, entry.commit, commitUrl(entry.commit), true));
        if (entry.summarizes !== null) {
          lines.push(
            `  - Summary of ${entry.summarizes} commits with the same subject; the link above is the commit that completed the change. All of them: ${entry.commits.join(', ')}`
          );
        }
      }
      lines.push('');
    }

    if (item.hidden > 0) {
      lines.push(`_${item.hidden} further changes in this version were withheld by the filter._`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function toPlainText(result: FilterResult, filter: ChangelogFilter, ctx: FormatContext, grouped: boolean): string {
  const lines: string[] = [`${ctx.productName} changelog`, '='.repeat(`${ctx.productName} changelog`.length), ''];
  for (const line of headerLines(result, filter, ctx)) lines.push(line);
  lines.push('');

  if (result.releases.length === 0) {
    lines.push('No version matched the filter that produced this file.');
    lines.push('');
    return lines.join('\n');
  }

  for (const item of result.releases) {
    const release = item.release;
    const title = release.released ? release.version : `${ctx.unreleasedLabel} (${release.version})`;
    const heading = `${title}  —  ${release.date}`;
    lines.push(heading);
    lines.push('-'.repeat(heading.length));
    lines.push(`Tagged at ${release.commit}`);
    lines.push(`${release.entries.length} recorded changes from ${release.commitCount} commits`);
    lines.push('');

    if (item.entries.length === 0) {
      lines.push(
        release.entries.length === 0
          ? '  No changes are recorded for this version: its tag points at the same commit as the version before it.'
          : '  Every change in this version was withheld by the filter.'
      );
      lines.push('');
      continue;
    }

    const sections = grouped
      ? groupByCategory(item.entries)
      : [{ category: null as ChangeCategory | null, entries: item.entries }];

    for (const section of sections) {
      if (section.category !== null) lines.push(`  ${ctx.categoryLabel(section.category)}`);
      for (const entry of section.entries) {
        const prefix = entry.breaking ? 'BREAKING. ' : '';
        const label = section.category === null ? `${ctx.categoryLabel(entry.category)}: ` : '';
        lines.push(entryLine(`${prefix}${label}${entry.summary}`, entry.commit, null, false));
        if (entry.summarizes !== null) {
          lines.push(`      summary of ${entry.summarizes} commits: ${entry.commits.join(', ')}`);
        }
      }
      lines.push('');
    }

    if (item.hidden > 0) {
      lines.push(`  ${item.hidden} further changes in this version were withheld by the filter.`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * One flat row per change, for the generic exporter.
 *
 * `commitUrl` is written out rather than left to the reader to assemble, and it
 * is an empty string — never a guessed URL — when there is no recognised forge.
 */
export function toRows(result: FilterResult, ctx: FormatContext): ChangelogRow[] {
  const rows: ChangelogRow[] = [];
  for (const item of result.releases) {
    for (const entry of item.entries) {
      rows.push({
        version: item.release.version,
        released: item.release.released,
        date: item.release.date,
        category: entry.category,
        breaking: entry.breaking,
        summary: entry.summary,
        body: entry.body,
        commit: entry.commit,
        shortCommit: entry.shortCommit,
        commitUrl: commitUrl(entry.commit) ?? '',
        author: entry.author,
        authoredAt: entry.authoredAt,
        summarizes: entry.summarizes ?? 1
      });
    }
    if (item.entries.length === 0) {
      // A version with no recorded changes still gets a row, so a spreadsheet of
      // this export cannot quietly lose a released version.
      rows.push({
        version: item.release.version,
        released: item.release.released,
        date: item.release.date,
        category: 'other',
        breaking: false,
        summary: 'No changes are recorded for this version.',
        body: '',
        commit: item.release.commit,
        shortCommit: item.release.shortCommit,
        commitUrl: commitUrl(item.release.commit) ?? '',
        author: '',
        authoredAt: item.release.timestamp,
        summarizes: 0
      });
    }
  }
  return rows;
}

/** A file name that says what is inside without needing the file opened. */
export function suggestFileName(result: FilterResult, extension: string): string {
  const { first, last } = coverage(result);
  const scope = first === null || last === null ? 'empty' : first === last ? first : `${first}-to-${last}`;
  const safe = scope.replace(/[^A-Za-z0-9._-]+/g, '-');
  return `changelog-${safe}.${extension}`;
}
