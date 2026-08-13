/**
 * The shape of the bundled changelog record.
 *
 * `generated.ts` is written by `app/scripts/generate-changelog.mjs` from the
 * repository's real commit history and is annotated with `ChangelogData`, so a
 * generator that starts emitting a different shape is a compile error rather
 * than a runtime surprise in front of a user.
 *
 * Nothing in this file may be invented at runtime. Every version, date, summary
 * and commit reference comes from git; a release with no recorded changes says
 * so instead of being filled with something plausible.
 */

/**
 * What a change did.
 *
 * `merged` is a merge commit and `reverted` undoes an earlier one; both are kept
 * rather than filtered away, because a changelog that silently drops commits is
 * a changelog whose counts cannot be checked against `git log`.
 */
export type ChangeCategory =
  | 'added'
  | 'changed'
  | 'fixed'
  | 'removed'
  | 'security'
  | 'performance'
  | 'documentation'
  | 'maintenance'
  | 'reverted'
  | 'merged'
  | 'other';

export const CHANGE_CATEGORIES: readonly ChangeCategory[] = [
  'added',
  'changed',
  'fixed',
  'removed',
  'security',
  'performance',
  'documentation',
  'maintenance',
  'reverted',
  'merged',
  'other'
] as const;

/** Where a commit reference can be resolved to a page a person can open. */
export interface ForgeInfo {
  /** `github`, `gitlab`, `gitea`, `bitbucket`, or `unknown`. */
  kind: string;
  /** Owner or namespace, empty when the remote could not be parsed. */
  owner: string;
  /** Repository name, empty when the remote could not be parsed. */
  repository: string;
  /** Browsable repository root, or null when there is no recognisable forge. */
  webUrl: string | null;
  /**
   * An https URL containing the literal `{sha}`, or null.
   *
   * Null is a real state and not a failure: the viewer then renders the commit
   * id as plain selectable text and says the remote is not a recognised forge,
   * rather than building a link that goes nowhere.
   */
  commitUrlTemplate: string | null;
  /** The remote the template was derived from, with any credentials stripped. */
  remote: string | null;
}

export interface ChangeEntry {
  /** Stable within the bundle: `<tag>#<index>`. Used as a list row id. */
  id: string;
  category: ChangeCategory;
  /** True when the commit declared a breaking change. */
  breaking: boolean;
  /** The commit subject, exactly as written. Never rewritten or paraphrased. */
  summary: string;
  /** The commit body, exactly as written. Empty when there was none. */
  body: string;
  /** True when `body` was cut at the bundle's per-entry ceiling. */
  bodyTruncated: boolean;
  /** Full 40-character commit id of the commit that completed this change. */
  commit: string;
  /** The first 7 characters of `commit`, for the short clickable reference. */
  shortCommit: string;
  /** ISO-8601 author date of that commit. */
  authoredAt: string;
  /** Author name as git records it. */
  author: string;
  /**
   * Null for an ordinary one-commit entry.
   *
   * When several commits carried the same subject they are one entry, linked to
   * the commit that COMPLETED the change, and this is how many commits it
   * stands for. The viewer says the entry is a summary rather than implying the
   * single link is the whole story.
   */
  summarizes: number | null;
  /** Every commit the entry stands for, oldest first. Includes `commit`. */
  commits: string[];
}

export interface ReleaseRecord {
  /** The version a person identifies this build by. The tag name. */
  version: string;
  /** The git tag, or null for the unreleased section. */
  tag: string | null;
  /** True for a published tag, false for the work after the newest tag. */
  released: boolean;
  /** `YYYY-MM-DD` in the tag's own recorded timezone. */
  date: string;
  /** Full ISO-8601 timestamp the date was taken from. */
  timestamp: string;
  /** The commit the tag points at, or HEAD for the unreleased section. */
  commit: string;
  shortCommit: string;
  /** The tag this release's range started from, or null for the first one. */
  previousTag: string | null;
  entries: ChangeEntry[];
  /** Commits in the range, before identical subjects were folded together. */
  commitCount: number;
}

export interface ChangelogData {
  schemaVersion: 1;
  /** ISO-8601 timestamp the bundle was generated at. */
  generatedAt: string;
  /** The script that wrote it, so the file can be regenerated. */
  generator: string;
  /** The command that regenerates it, quoted verbatim in the viewer. */
  command: string;
  forge: ForgeInfo;
  /** The commit the bundle was generated from. */
  headCommit: string;
  /** Newest first. Includes the unreleased section when there is one. */
  releases: ReleaseRecord[];
  /**
   * Commits across every release range, summed.
   *
   * It is deliberately NOT the number of distinct commits in the repository:
   * where tags do not sit on one linear history, two ranges can legitimately
   * contain the same commit and it is counted in both. The viewer says exactly
   * that rather than presenting the number as a repository total.
   */
  commitsExamined: number;
  /** Per-entry body ceiling in characters, stated so truncation is auditable. */
  bodyLimit: number;
}

/** One release row flattened for the generic exporter and the clipboard. */
export interface ChangelogRow extends Record<string, unknown> {
  version: string;
  released: boolean;
  date: string;
  category: ChangeCategory;
  breaking: boolean;
  summary: string;
  body: string;
  commit: string;
  shortCommit: string;
  commitUrl: string;
  author: string;
  authoredAt: string;
  summarizes: number;
}
