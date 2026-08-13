/**
 * Every stored key this feature owns.
 *
 * They are constants rather than literals scattered through the code because a
 * setting id is a stable, shipped name: renaming one silently orphans whatever a
 * user had already chosen, and a typo at one call site produces a value that is
 * written and never read.
 */

/* Settings the user sees and changes. */
export const ENABLED_ID = 'updates.enabled';
export const FEED_URL_ID = 'updates.feedUrl';
export const RELEASE_NOTES_ID = 'updates.releaseNotesUrl';
export const CHECK_ON_STARTUP_ID = 'updates.checkOnStartup';
export const STARTUP_DELAY_ID = 'updates.startupDelaySeconds';
export const INTERVAL_HOURS_ID = 'updates.intervalHours';
export const AUTO_DOWNLOAD_ID = 'updates.autoDownload';
export const ACCEPT_PRERELEASE_ID = 'updates.acceptPrerelease';
export const ALLOW_DOWNGRADE_ID = 'updates.allowDowngrade';
export const MAX_PACKAGE_BYTES_ID = 'updates.maxPackageBytes';
export const CHUNK_BYTES_ID = 'updates.chunkBytes';
export const VERIFY_AFTER_WRITE_ID = 'updates.verifyAfterWrite';
export const SNOOZE_HOURS_ID = 'updates.snoozeHours';
export const LOG_PAGE_SIZE_ID = 'updates.logPageSize';
export const CHECK_ACTION_ID = 'updates.checkNow';
export const STATUS_ID = 'updates.status';

/* Records the feature keeps for itself. Stored beside the settings, never shown
 * as controls, and declared so a reset can reach them like anything else. */
export const STORED_STAGED_ID = 'updates.record.staged';
export const STORED_LOG_ID = 'updates.record.log';
export const STORED_LAST_CHECK_ID = 'updates.record.lastCheckedAt';
export const STORED_SNOOZE_ID = 'updates.record.snoozedUntil';

/** The default release feed: the project's own published `RELEASES` document. */
export const DEFAULT_FEED_URL =
  'https://github.com/Ding-Ding-Projects/minecraft-world-downloader/releases/latest/download/RELEASES';

/** Where the release notes for the newest published build live. */
export const DEFAULT_RELEASE_NOTES_URL =
  'https://github.com/Ding-Ding-Projects/minecraft-world-downloader/releases/latest';

/** Ceiling on a single staged package. 256 MiB, well above a real Electron build. */
export const DEFAULT_MAX_PACKAGE_BYTES = 268_435_456;

/** One transfer chunk. Below the privileged bridge's own per-response ceiling. */
export const DEFAULT_CHUNK_BYTES = 4_194_304;

/** Tab and element ids, so the palette can teleport to an exact control. */
export const UPDATES_TAB_ID = 'updates.main';
export const STATUS_CARD_ID = 'updates-status-card';
export const ACTIONS_ROW_ID = 'updates-actions-row';
export const LOG_TABLE_ID = 'updates-log-table';
export const SEARCH_ELEMENT_ID = 'updates-log-search';
